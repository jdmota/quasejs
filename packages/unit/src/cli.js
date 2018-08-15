import validateOptions from "./core/validate-options";
import NodeReporter from "./reporters/node";

const SourceMapExtractor = require( require.resolve( "@quase/source-map" ).replace( "index.js", "extractor.js" ) ).default;
const globby = require( "globby" );
const FileSystem = require( "@quase/cacheable-fs" ).default;
const { printError } = require( "@quase/config" );
const { beautify: beautifyStack } = require( "@quase/error" );
const { EventEmitter } = require( "events" );
const path = require( "path" );
const childProcess = require( "child_process" );
const CircularJSON = require( "circular-json" );
const ora = require( "ora" );

const reDebugger = /Debugger listening on (ws:\/\/.+)\r?\n/;
const reDebuggerWaiting = /Waiting for the debugger to disconnect/;

function getDebugger( child ) {
  return new Promise( ( resolve, reject ) => {
    function error() {
      reject( new Error( "Waited for debugger for too long" ) );
    }

    const timeoutId = setTimeout( error, 10000 );
    let str = "";

    function cb( data ) {
      str += data;
      const m = str.match( reDebugger );
      if ( m ) {
        child.stderr.removeListener( "data", cb );
        clearTimeout( timeoutId );
        resolve( m[ 1 ] );
      }
    }

    child.stderr.on( "data", cb );
  } );
}

function getDebuggerWaiting( child ) {
  return new Promise( resolve => {
    let str = "";
    function cb( data ) {
      str += data;
      if ( reDebuggerWaiting.test( str ) ) {
        child.stderr.removeListener( "data", cb );
        resolve();
      }
    }
    child.stderr.on( "data", cb );
  } );
}

function concat( original, array ) {
  for ( let i = 0; i < array.length; i++ ) {
    original.push( array[ i ] );
  }
  return original;
}

class RunnerProcess {

  constructor( runner, files, cli, args, env, execArgv ) {
    this.started = false;

    this.process = childProcess.fork(
      path.resolve( __dirname, "fork.js" ),
      args,
      { cwd: process.cwd(), env, execArgv, silent: true }
    );

    this.process.send( {
      type: "quase-unit-start",
      files,
      cli
    } );

    this.onMessage = msg => {
      runner.onChildEmit( this, msg );
    };

    this.onExit = ( code, signal ) => {
      if ( code !== 0 ) {
        const e = new Error( `Child process exited with code ${code} and signal ${signal}.` );
        runner.emit( "otherError", e );
      }
    };

    this.process.on( "message", this.onMessage );
    this.process.on( "exit", this.onExit );
  }

  removeAllListeners() {
    this.process.removeAllListeners();
  }

  send( msg ) {
    this.process.send( msg );
  }

  disconnect() {
    this.process.disconnect();
  }

  get stdout() {
    return this.process.stdout;
  }

  get stderr() {
    return this.process.stderr;
  }

  kill( signal ) {
    this.removeAllListeners();
    this.process.kill( signal );
  }

}

class NodeRunner extends EventEmitter {

  constructor( options, files ) {
    super();
    this.options = options;
    this.files = files;
    this.forks = [];
    this.debuggersPromises = [];
    this.debuggersWaitingPromises = [];
    this.timeStart = undefined;
    this.runStartArg = {
      name: "",
      fullname: [],
      tests: [], // Fill
      childSuites: [], // Fill
      testCounts: {
        passed: undefined,
        failed: undefined,
        skipped: undefined,
        todo: undefined,
        total: 0 // Increment
      }
    };
    this.runEndArg = {
      name: "",
      fullname: [],
      status: "passed", // Fill
      runtime: 0, // Fill
      testCounts: {
        passed: 0, // Increment
        failed: 0, // Increment
        skipped: 0, // Increment
        todo: 0, // Increment
        total: 0 // Increment
      },
      snapshotStats: {
        added: 0, // Increment
        updated: 0, // Increment
        removed: 0, // Increment
        obsolete: 0 // Increment
      },
      onlyCount: 0 // Increment
    };
    this.runStarts = 0;
    this.runEnds = 0;
    this.runStartEmmited = false;
    this.runEndEmmited = false;
    this.buffer = [];
    this.pendingTests = new Set();
    this.failedOnce = false;

    this.extractor = new SourceMapExtractor( new FileSystem() );

    process.once( "beforeExit", async() => {
      this.emit( "exit", {} );
    } );
  }

  runEnd( signal ) {
    if ( this.runEndEmmited ) {
      return;
    }
    this.runEndEmmited = true;

    let runStartNotEmitted = 0;

    for ( const fork of this.forks ) {
      if ( signal ) {
        fork.kill( signal );
      } else {
        fork.send( {
          type: "quase-unit-exit"
        } );
      }
      if ( !fork.started ) {
        runStartNotEmitted++;
      }
    }

    this.runEndArg.pendingTests = this.pendingTests;
    this.runEndArg.runStartNotEmitted = runStartNotEmitted;

    if ( this.runEndArg.testCounts.total === this.runEndArg.testCounts.skipped ) {
      this.runEndArg.status = "skipped";
    } else if ( this.runEndArg.testCounts.total === this.runEndArg.testCounts.todo ) {
      this.runEndArg.status = "todo";
    } else if ( this.runEndArg.testCounts.failed ) {
      this.runEndArg.status = "failed";
    } else {
      this.runEndArg.status = "passed";
    }

    this.emit( "runEnd", this.runEndArg );
  }

  testFailure() {
    if ( this.failedOnce ) {
      return;
    }
    this.failedOnce = true;

    if ( this.options.bail ) {
      for ( const fork of this.forks ) {
        fork.send( {
          type: "quase-unit-bail"
        } );
      }
    }
  }

  onChildEmit( forkProcess, msg ) {
    if ( msg.type === "quase-unit-emit" ) {

      const eventType = msg.eventType;
      const arg = CircularJSON.parse( msg.arg );

      if ( eventType === "runStart" ) {
        forkProcess.started = true;

        concat( this.runStartArg.tests, arg.tests );
        concat( this.runStartArg.childSuites, arg.childSuites );
        this.runStartArg.testCounts.total += arg.testCounts.total;

        if ( ++this.runStarts === this.forks.length ) {
          this.timeStart = Date.now();

          this.emit( eventType, this.runStartArg );
          this.runStartEmmited = true;

          const buffer = this.buffer;
          this.buffer = null;

          for ( const { eventType, arg } of buffer ) {
            this.emit( eventType, arg );
          }
        }
      } else if ( eventType === "runEnd" ) {
        this.runEndArg.testCounts.passed += arg.testCounts.passed;
        this.runEndArg.testCounts.failed += arg.testCounts.failed;
        this.runEndArg.testCounts.skipped += arg.testCounts.skipped;
        this.runEndArg.testCounts.todo += arg.testCounts.todo;
        this.runEndArg.testCounts.total += arg.testCounts.total;

        this.runEndArg.snapshotStats.added += arg.snapshotStats.added;
        this.runEndArg.snapshotStats.updated += arg.snapshotStats.updated;
        this.runEndArg.snapshotStats.removed += arg.snapshotStats.removed;
        this.runEndArg.snapshotStats.obsolete += arg.snapshotStats.obsolete;

        this.runEndArg.onlyCount += arg.onlyCount;

        if ( ++this.runEnds === this.forks.length ) {
          if ( this.timeStart ) {
            this.runEndArg.runtime = Date.now() - this.timeStart;
          }
          this.runEnd();
        }
      } else if ( eventType === "otherError" ) {
        this.emit( eventType, arg );
        if ( !forkProcess.started ) {
          forkProcess.disconnect();
        }
      } else {

        if ( eventType === "testStart" ) {
          this.pendingTests.add( arg.defaultStack );
        } else if ( eventType === "testEnd" ) {
          this.pendingTests.delete( arg.defaultStack );

          if ( arg.status === "failed" ) {
            this.testFailure();
          }
        }

        if ( this.runStartEmmited ) {
          this.emit( eventType, arg );
        } else {
          this.buffer.push( {
            eventType,
            arg
          } );
        }
      }

    } else if ( msg.type === "quase-unit-source" ) {
      this.beautifyStack( msg.stack ).then( ( { source } ) => {
        forkProcess.send( {
          type: "quase-unit-source",
          id: msg.id,
          source
        } );
      } );
    }
  }

  async beautifyStack( stack ) {
    return beautifyStack( stack, this.extractor, {
      ignore: this.options.stackIgnore
    } );
  }

  async divide() {
    const num = this.options.concurrency;
    const final = [];
    const map = new Map(); // Map<original, Set<generated>>
    // The snapshot managers are in the fork process
    // and we try to point to the original sources.
    // If a original is used more than once, we have to join
    // the respective generated files in the same fork.
    // Since this is very rare, we just put all these
    // in the same fork (even if some share nothing).
    const weirdFiles = new Set();

    await Promise.all(
      this.files.map( async file => {
        for ( const src of await this.extractor.getOriginalSources( file ) ) {
          const set = map.get( src ) || new Set();
          set.add( file );
          map.set( src, set );
        }
      } )
    );

    for ( let i = 0; i < num; i++ ) {
      final.push( [] );
    }

    for ( const set of map.values() ) {
      if ( set.size > 1 ) {
        for ( const f of set ) {
          weirdFiles.add( f );
        }
      }
    }

    if ( weirdFiles.size ) {
      for ( let i = 0; i < this.files.length; i++ ) {
        const file = this.files[ i ];
        if ( weirdFiles.has( file ) ) {
          final[ 0 ].push( file );
        } else {
          final[ i % ( num - 1 ) + 1 ].push( file );
        }
      }
    } else {
      for ( let i = 0; i < this.files.length; i++ ) {
        const file = this.files[ i ];
        final[ i % num ].push( file );
      }
    }

    return final;
  }

  async start( cli ) {
    const options = this.options;
    const division = await this.divide();

    const env = Object.assign( { NODE_ENV: "test" }, process.env, options.env );
    const execArgv = [];
    const args = [];
    let debugging = false;

    if ( options.logHeapUsage ) {
      args.push( "--expose-gc" );
    }

    for ( const arg of options[ "--" ] ) {
      args.push( arg );
    }

    if ( options.debug ) {
      execArgv.push( "--inspect-brk=0" );
      debugging = true;
    }

    if ( options.inspect === true ) {
      execArgv.push( "--inspect" );
      debugging = true;
    } else if ( options.inspect ) {
      execArgv.push( "--inspect=" + options.inspect );
      debugging = true;
    }

    if ( options.inspectBrk === true ) {
      execArgv.push( "--inspect-brk" );
      debugging = true;
    } else if ( options.inspectBrk ) {
      execArgv.push( "--inspect-brk=" + options.inspectBrk );
      debugging = true;
    }

    for ( let i = 0; i < division.length; i++ ) {
      if ( division[ i ].length ) {
        const fork = new RunnerProcess( this, division[ i ], cli, args, env, execArgv );
        this.forks.push( fork );
        if ( debugging ) {
          this.debuggersPromises.push( getDebugger( fork ) );
          this.debuggersWaitingPromises.push( getDebuggerWaiting( fork ) );
        }
      }
    }

    this.emit( "start" );

    process.once( "SIGINT", () => {
      this.runEnd( "SIGINT" );
    } );

    return this;
  }

}

const turbocolor = require( "turbocolor" );

export default function cli( { input, options, configLocation } ) {

  if ( input.length > 0 ) {
    options.files = input;
  }

  try {
    validateOptions( options );
  } catch ( err ) {
    return printError( err );
  }

  turbocolor.enabled = options.color;

  NodeReporter.showOptions( options );

  const spinner = ora( "Looking for files..." ).start();

  return globby( options.files, {
    ignore: options.ignore,
    absolute: true,
    gitignore: true
  } ).then( files => {

    spinner.stop();

    if ( files.length === 0 ) {
      return NodeReporter.fatalError( "Zero files found." );
    }

    NodeReporter.showFilesCount( files.length );

    const Reporter = options.reporter;
    const runner = new NodeRunner( options, files );

    new Reporter( runner ); // eslint-disable-line no-new

    runner.start( { options, configLocation } );

  } ).catch( err => {
    spinner.stop();
    NodeReporter.fatalError( err );
  } );
}
