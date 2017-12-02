import { testEnd, logError } from "./node-test-end";
import colors from "./colors";
import { log, logEol } from "./log";

const chalk = require( "chalk" );
const ora = require( "ora" );
const { prettify } = require( "@quase/path-url" );

export default class NodeReporter {

  constructor( runner ) {
    this.runner = runner;
    this.spinner = null;
    this.tests = [];
    this.otherErrors = [];
    this.ended = false;
    this.didAfterRun = false;
    runner.on( "runStart", this.runStart.bind( this ) );
    runner.on( "testEnd", this.testEnd.bind( this ) );
    runner.on( "runEnd", this.runEnd.bind( this ) );
    runner.on( "otherError", err => {
      if ( this.ended ) {
        this.afterRun();
        logError( err );
      } else {
        this.otherErrors.push( err );
      }
    } );
    runner.on( "exit", () => {
      this.logOtherErrors();
    } );

    logEol();
    this.showConcurrency( runner );
    this.showDebuggers( runner );
  }

  showConcurrency( runner ) {
    log( chalk.bold.green( "Concurrency: " ) + runner.options.concurrency + "\n" );
    logEol();
  }

  showDebuggers( { debuggersPromises, division } ) {
    if ( !debuggersPromises.length ) {
      return;
    }
    Promise.all( debuggersPromises ).then( debuggers => {
      log( chalk.bold.yellow( "Debugging" ) );
      logEol();
      log( chalk.bold.yellow( "Got to chrome://inspect or check https://nodejs.org/en/docs/inspector" ) );
      logEol();
      for ( let i = 0; i < debuggers.length; i++ ) {
        log( chalk.bold( debuggers[ i ] ), 4 );
        logEol();
        for ( const file of division[ i ] ) {
          log( prettify( file ), 6 );
          logEol();
        }
      }
      logEol();
    } );
  }

  static async fatalError( error ) {
    process.exitCode = 1;
    logEol();
    log( chalk.bold.red( error ) );
    logEol();
  }

  async logOtherErrors() {
    const otherErrors = this.otherErrors;
    this.otherErrors = [];

    if ( otherErrors.length > 0 ) {
      this.afterRun();
      for ( let i = 0; i < otherErrors.length; i++ ) {
        await logError( otherErrors[ i ] ); // eslint-disable-line no-await-in-loop
      }
    }
  }

  afterRun() {
    if ( !this.didAfterRun ) {
      this.didAfterRun = true;
      process.stdout.write( "\n  More errors:\n" );
    }
  }

  static init( runner ) {
    return new NodeReporter( runner );
  }

  runStart() {
    this.spinner = ora( "Running tests..." ).start();
  }

  runEnd( t ) {
    setTimeout( async() => {

      this.spinner.stop();

      for ( let i = 0; i < this.tests.length; i++ ) {
        await testEnd( this.tests[ i ] ); // eslint-disable-line no-await-in-loop
      }

      this.tests = null; // Prevent memory leaks
      this.ended = true;

      const { passed, skipped, todo, failed, total } = t.testCounts;

      process.exitCode = failed || !total || this.otherErrors.length ? 1 : 0;

      let lines;

      if ( total === 0 ) {
        lines = [
          colors.error( "\n  The total number of tests was 0." )
        ];
      } else {
        lines = [
          passed > 0 ? "\n  " + colors.pass( passed, "passed" ) : "",
          skipped > 0 ? "\n  " + colors.skip( skipped, "skipped" ) : "",
          todo > 0 ? "\n  " + colors.todo( todo, "todo" ) : "",
          failed > 0 ? "\n  " + colors.error( failed, "failed" ) : "",
          "\n\n  " + colors.duration( t.runtime, "ms" ),
          t.onlyCount ? `\n\n  The '.only' modifier was used ${t.onlyCount} time${t.onlyCount === 1 ? "" : "s"}.` : ""
        ].filter( Boolean );
      }

      lines.push( `\n\n  ${colors.duration( `[${new Date().toLocaleTimeString()}]` )}\n\n` );

      process.stdout.write( lines.join( "" ) );

      await this.logOtherErrors();

      const debuggersWaitingPromises = this.runner.debuggersWaitingPromises;

      if ( debuggersWaitingPromises.length ) {
        Promise.race( debuggersWaitingPromises ).then( () => {
          log( chalk.bold.yellow( "At least 1 of " + debuggersWaitingPromises.length + " processes are waiting for the debugger to disconnect..." ) );
          logEol();
        } );
      }

    } );
  }

  testEnd( t ) {
    this.tests.push( t );
  }

}
