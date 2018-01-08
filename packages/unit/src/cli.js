import { processError } from "./core/process-error";
import validateOptions from "./core/validate-options";
import NodeReporter from "./reporters/node";
import SnapshotsManager from "./snapshots";

const SourceMapExtractor = require( require.resolve( "@quase/source-map" ).replace( "index.js", "extractor.js" ) ).default;
const findFiles = require( "@quase/find-files" ).default;
const FileSystem = require( "@quase/cacheable-fs" ).default;
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

function divide( array, num ) {
  const final = [];

  for ( let i = 0; i < num; i++ ) {
    final.push( [] );
  }

  for ( let i = 0, j = 0; i < array.length; i++, j++ ) {
    final[ j % num ].push( array[ i ] );
  }

  return final;
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
    this.division = null;
    this.files = files;
    this.forks = [];
    this.debuggersPromises = [];
    this.debuggersWaitingPromises = [];
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
      runtime: 0, // Increment
      testCounts: {
        passed: 0, // Increment
        failed: 0, // Increment
        skipped: 0, // Increment
        todo: 0, // Increment
        total: 0 // Increment
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
    this.snapshotManagers = new Map(); // Map<fullpath, SnapshotManager>

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

    this.saveSnapshots().then( snapshotStats => {
      this.runEndArg.snapshotStats = snapshotStats;
      this.emit( "runEnd", this.runEndArg );
    } );
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
        this.runEndArg.onlyCount += arg.onlyCount;
        this.runEndArg.runtime += arg.runtime;

        if ( ++this.runEnds === this.forks.length ) {
          this.runEnd();
        }
      } else if ( eventType === "otherError" ) {
        this.emit( eventType, arg );
        if ( !forkProcess.started ) {
          forkProcess.disconnect();
        }
      } else if ( eventType === "matchesSnapshot" ) {
        this.handleSnapshot( arg, forkProcess );
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

    }
  }

  async beautifyStack( stack ) {
    return beautifyStack( stack, this.extractor, {
      ignore: this.options.stackIgnore
    } );
  }

  async handleSnapshot( { byteArray, stack, fullname, id }, forkProcess ) {

    const { source } = await this.beautifyStack( stack );
    const { file, line, column } = source;

    let manager = this.snapshotManagers.get( file );
    if ( !manager ) {
      manager = new SnapshotsManager(
        process.cwd(),
        file,
        this.options.snapshotDir,
        this.options.updateSnapshots,
        this.options.concordanceOptions
      );
      this.snapshotManagers.set( file, manager );
    }

    let error;

    try {
      manager.matchesSnapshot(
        fullname.join( " " ),
        `${fullname.join( " " )} (${line}:${column})`,
        Buffer.from( byteArray )
      );
    } catch ( e ) {
      error = processError( e, stack, this.options.concordanceOptions );
    }

    forkProcess.send( {
      type: "quase-unit-snap-result",
      id,
      error: error && {
        message: error.message,
        stack: error.stack,
        diff: error.diff
      }
    } );

  }

  async saveSnapshots() {
    const promises = [];

    for ( const manager of this.snapshotManagers.values() ) {
      promises.push( manager.save() );
    }

    const stats = await Promise.all( promises );
    const finalStat = {
      added: 0,
      updated: 0,
      removed: 0,
      obsolete: 0
    };

    for ( const stat of stats ) {
      finalStat.added += stat.added;
      finalStat.updated += stat.updated;
      finalStat.removed += stat.removed;
      finalStat.obsolete += stat.obsolete;
    }

    return finalStat;
  }

  start( cli ) {
    const options = this.options;
    this.division = divide( this.files, options.concurrency );

    const env = Object.assign( { NODE_ENV: "test" }, process.env, options.env );
    const execArgv = [];
    const args = [];
    let debugging = false;

    if ( options.logHeapUsage ) {
      args.push( "--expose-gc" );
    }

    if ( options.color ) {
      args.push( "--color" );
    } else {
      args.push( "--no-color" );
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

    for ( let i = 0; i < options.concurrency; i++ ) {
      const fork = new RunnerProcess( this, this.division[ i ], cli, args, env, execArgv );
      this.forks.push( fork );
      if ( debugging ) {
        this.debuggersPromises.push( getDebugger( fork ) );
        this.debuggersWaitingPromises.push( getDebuggerWaiting( fork ) );
      }
    }

    process.once( "SIGINT", () => {
      this.runEnd( "SIGINT" );
    } );

    return this;
  }

}

export default function cli( { input, options, configLocation } ) {

  if ( input.length > 0 ) {
    options.files = input;
  }

  try {
    validateOptions( options );
  } catch ( err ) {
    return NodeReporter.fatalError( err );
  }

  const spinner = ora( "Looking for files..." ).start();

  const files = [];
  const observable = findFiles( { src: options.files } );

  observable.subscribe( {
    next( file ) {
      files.push( file );
    },
    complete() {
      spinner.stop();

      if ( files.length === 0 ) {
        return NodeReporter.fatalError( "Zero files found." );
      }

      NodeReporter.showFilesCount( files.length );

      const Reporter = options.reporter;
      new Reporter( // eslint-disable-line no-new
        new NodeRunner( options, files ).start( { options, configLocation } )
      );
    },
    error( err ) {
      spinner.stop();
      NodeReporter.fatalError( err );
    }
  } );

}
