import NodeReporter from "./reporters/node";

const { EventEmitter } = require( "events" );
const path = require( "path" );
const childProcess = require( "child_process" );
const os = require( "os" );
const CircularJSON = require( "circular-json" );
const isCi = require( "is-ci" );

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
    this.buffer = [];

    process.on( "beforeExit", () => {
      this.emit( "exit", {} );
    } );
  }

  onChildEmit( childIdx, msg ) {
    if ( msg.type === "quase-unit-emit" ) {

      const eventType = msg.eventType;
      const arg = CircularJSON.parse( msg.arg );

      if ( eventType === "runStart" ) {
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
        this.forks[ childIdx ].disconnect();

        this.runEndArg.testCounts.passed += arg.testCounts.passed;
        this.runEndArg.testCounts.failed += arg.testCounts.failed;
        this.runEndArg.testCounts.skipped += arg.testCounts.skipped;
        this.runEndArg.testCounts.todo += arg.testCounts.todo;
        this.runEndArg.testCounts.total += arg.testCounts.total;
        this.runEndArg.onlyCount += arg.onlyCount;
        this.runEndArg.runtime += arg.runtime;

        if ( this.runEndArg.testCounts.total === this.runEndArg.testCounts.skipped ) {
          this.runEndArg.status = "skipped";
        } else if ( this.runEndArg.testCounts.total === this.runEndArg.testCounts.todo ) {
          this.runEndArg.status = "todo";
        } else if ( this.runEndArg.testCounts.failed ) {
          this.runEndArg.status = "failed";
        } else {
          this.runEndArg.status = "passed";
        }

        if ( ++this.runEnds === this.forks.length ) {
          this.emit( eventType, this.runEndArg );
        }
      } else {
        if ( this.runStartEmmited || eventType === "otherError" ) {
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

  start( cli ) {
    const options = this.options;
    this.division = divide( this.files, options.concurrency );

    const env = Object.assign( { NODE_ENV: "test" }, process.env );
    const execArgv = [];
    const args = [];
    let debugging = false;

    if ( !options.color ) {
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
      const fork = childProcess.fork(
        path.resolve( __dirname, "fork.js" ),
        args,
        { env, execArgv, silent: true }
      );
      this.forks.push( fork );
      fork.send( {
        type: "quase-unit-start",
        cli,
        files: this.division[ i ]
      } );
      fork.on( "message", this.onChildEmit.bind( this, i ) );
      fork.on( "exit", ( code, signal ) => {
        if ( code !== 0 ) {
          const e = new Error( `Child process ${i} exited with code ${code} and signal ${signal}.` );
          this.emit( "otherError", e );
        }
      } );
      if ( debugging ) {
        this.debuggersPromises.push( getDebugger( fork ) );
        this.debuggersWaitingPromises.push( getDebuggerWaiting( fork ) );
      }
    }

    return this;
  }

}

export default function cli( { input, flags, config, configLocation } ) {
  const options = Object.assign( {}, config, flags );

  if ( options.inspect || options.inspectBrk ) {
    if ( options.debug ) {
      return NodeReporter.fatalError( `You cannot use "debug" with --inspect or --inspect-brk` );
    }
    if ( options.concurrency != null && options.concurrency !== 1 ) {
      return NodeReporter.fatalError( `You cannot use "concurrency" with --inspect or --inspect-brk` );
    }
  }

  options.concurrency = options.concurrency > 0 ? options.concurrency : Math.min( os.cpus().length, isCi ? 2 : Infinity );
  options.color = options.color === undefined ? true : !!options.color;

  if ( options.inspect || options.inspectBrk ) {
    options.concurrency = 1;
  }

  const files = input.map( f => path.resolve( f ) );

  new NodeReporter( // eslint-disable-line no-new
    new NodeRunner( options, files ).start( { flags, config, configLocation } )
  );
}

cli( { input: [ "packages/unit/ui-tests/index.js" ], flags: { inspectBrk: true } } );
