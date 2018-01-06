import colors from "./colors";
import { log, log as printLog, logEol, indentString } from "./log";

const chalk = require( "chalk" );
const logSymbols = require( "log-symbols" );
const ora = require( "ora" );
const codeFrameColumns = require( "babel-code-frame" ).codeFrameColumns;
const { beautify: beautifyStack } = require( "@quase/error" );
const { prettify } = require( "@quase/path-url" );

export default class NodeReporter {

  constructor( runner ) {
    this.runner = runner;
    this.extractor = runner.extractor;
    this.spinner = null;
    this.pendingTests = new Set();
    this.tests = [];
    this.otherErrors = [];
    this.ended = false;
    this.didAfterRun = false;
    runner.on( "runStart", this.runStart.bind( this ) );
    runner.on( "testStart", this.testStart.bind( this ) );
    runner.on( "testEnd", this.testEnd.bind( this ) );
    runner.on( "runEnd", this.runEnd.bind( this ) );
    runner.on( "otherError", err => {
      this.otherErrors.push( err );
      if ( this.ended ) {
        this.logOtherErrors();
      }
    } );
    runner.on( "exit", async() => {
      NodeReporter.showSeed( runner );

      await this.logOtherErrors();

      if ( process.exitCode ) {
        log( chalk.bold.red( "Exit code: " + process.exitCode ) );
      } else {
        log( chalk.bold.green( "Exit code: 0" ) );
      }
      logEol();
    } );

    NodeReporter.showConcurrency( runner );
    NodeReporter.showDebuggers( runner );

    this.spinner = ora( `Waiting for "runStart"...` ).start();
  }

  static showFilesCount( count ) {
    logEol();
    log( chalk.bold.green( "Files count: " ) + count + "\n" );
    logEol();
  }

  static showSeed( runner ) {
    if ( runner.options.random ) {
      log( chalk.bold.yellow( "Random seed: " ) + runner.options.random + "\n" );
      logEol();
    }
  }

  static showConcurrency( runner ) {
    log( chalk.bold.green( "Concurrency: " ) + runner.options.concurrency + "\n" );
    logEol();
  }

  static showDebuggers( { debuggersPromises, division } ) {
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

  static fatalError( error ) {
    process.exitCode = 1;
    logEol();
    log( chalk.bold.red( error ) );
    logEol();
  }

  async logOtherErrors() {
    const otherErrors = this.otherErrors;
    this.otherErrors = [];

    if ( otherErrors.length > 0 ) {
      process.exitCode = 1;

      this.afterRun();
      for ( let i = 0; i < otherErrors.length; i++ ) {
        await this.logError( otherErrors[ i ] ); // eslint-disable-line no-await-in-loop
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
    this.spinner.text = "Running tests...";
  }

  runEnd( t ) {
    setTimeout( async() => {

      this.spinner.stop();

      for ( let i = 0; i < this.tests.length; i++ ) {
        await this.logTestEnd( this.tests[ i ] ); // eslint-disable-line no-await-in-loop
      }

      this.tests = null; // Prevent memory leaks
      this.ended = true;

      const hasPending = t.pendingTests && t.pendingTests.size > 0;

      // If we had pending tests, don't trust the stats
      if ( t.runStartNotEmitted || hasPending ) {

        process.exitCode = 1;

        if ( t.runStartNotEmitted ) {
          log( `\n${chalk.bold.red( `${t.runStartNotEmitted} forks did not emit "runStart" event.` )}\n` );
        }

        if ( hasPending ) {
          log( `\n${chalk.bold.red( `${t.pendingTests.size} Pending tests:` )}\n` );

          for ( const stack of t.pendingTests ) {
            await this.logDefault( stack );
          }
        }

      } else {

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

        if ( t.snapshotStats ) {
          this.showSnapshotStats( lines, t.snapshotStats );
        }

        process.stdout.write( lines.join( "" ) );

      }

      log( `\n\n${colors.duration( `[${new Date().toLocaleTimeString()}]` )}\n\n` );

      await this.logOtherErrors();

      const debuggersWaitingPromises = this.runner.debuggersWaitingPromises;

      if ( debuggersWaitingPromises.length ) {
        Promise.race( debuggersWaitingPromises ).then( () => {
          log( chalk.bold.yellow( "At least 1 of " + debuggersWaitingPromises.length + " processes are waiting for the debugger to disconnect...\n" ) );
          logEol();
        } );
      }

    } );
  }

  showSnapshotStats( lines, { added, updated, removed, obsolete } ) {
    if ( added || updated || removed || obsolete ) {
      lines.push( chalk.blue( "\n\n  Snapshots" ) );
    }
    if ( added ) {
      lines.push( chalk.green( `\n    Added: ${added}` ) );
    }
    if ( updated ) {
      lines.push( chalk.green( `\n    Updated: ${updated}` ) );
    }
    if ( removed ) {
      lines.push( chalk.red( `\n    Removed: ${removed}` ) );
    }
    if ( obsolete ) {
      lines.push( chalk.red( `\n    Obsolete: ${obsolete}` ) );
    }
  }

  updateSpinner() {
    for ( const text of this.pendingTests ) {
      this.spinner.text = text;
      return;
    }
    this.spinner.text = "Waiting...";
  }

  testStart( t ) {
    this.pendingTests.add( t.fullname.join( " > " ) );
    if ( this.pendingTests.size === 1 ) {
      this.updateSpinner();
    }
  }

  testEnd( t ) {
    this.tests.push( t );
    this.pendingTests.delete( t.fullname.join( " > " ) );
    this.updateSpinner();
  }

  async enhanceError( original ) {

    const err = {
      actual: null,
      expected: null,
      diff: original.diff,
      stack: null,
      source: null,
      message: original.message
    };

    // Prevent memory leaks
    original.actual = null;
    original.expected = null;

    if ( original.stack ) {
      const { stack, source } = await beautifyStack( original.stack, this.extractor );
      err.stack = stack;
      err.source = source;
    }

    return err;
  }

  showSource( source ) {

    const { file, code, line, column } = source;

    if ( !file || !code ) {
      return "";
    }

    const codeFrameOptions = this.runner.options.codeFrame;
    const frame = codeFrameOptions === false ? "" : codeFrameColumns( code, { start: { line } }, codeFrameOptions ) + "\n\n";

    return `${colors.errorStack( `${prettify( file )}:${line}:${column}` )}\n\n${frame}`;
  }

  async logDefault( defaultStack ) {
    const { source } = await beautifyStack( defaultStack, this.extractor );
    let log = "\n";

    if ( source ) {
      log += this.showSource( source );
    }

    printLog( log, 4 );
  }

  makeLegend() {
    const { diffGutters } = this.runner.options.concordanceOptions.theme;
    return `${diffGutters.actual}Actual ${diffGutters.expected}Expected`;
  }

  async logError( e ) {

    const diff = this.runner.options.diff;
    const stack = this.runner.options.stack;

    const error = await this.enhanceError( e );
    let log = "\n";

    if ( error.message ) {
      log += colors.title( error.message ) + "\n";
    }

    if ( error.source ) {
      log += this.showSource( error.source );
    }

    if ( diff && error.diff ) {
      log += `${this.makeLegend()}\n\n${indentString( error.diff )}\n\n`;
    }

    if ( stack && error.stack ) {
      log += colors.errorStack( error.stack ) + "\n\n";
    }

    printLog( log, 4 );
  }

  async logTestEnd( { fullname, status, skipReason, errors, runtime, slow, logs, defaultStack, memoryUsage } ) {

    if ( status === "passed" && !slow && !logs.length ) {
      return;
    }

    const statusText = status === "failed" ? colors.error( status ) : status === "passed" ? colors.pass( status ) : colors.skip( status );

    printLog( `\n${colors.title( fullname.join( " > " ) )}\n${statusText} | ${runtime} ms ${slow ? colors.slow( "Slow!" ) : ""}\n` );

    if ( skipReason ) {
      printLog( `\nSkip reason: ${skipReason}`, 4 );
    }

    if ( errors.length ) {
      for ( let i = 0; i < errors.length; i++ ) {
        await this.logError( errors[ i ] ); // eslint-disable-line no-await-in-loop
      }
    } else {
      await this.logDefault( defaultStack );

      logs.forEach( log => {
        const logLines = indentString( colors.log( log ), 6 );
        const logLinesWithFigure = logLines.replace(
          /^ {6}/,
          `    ${logSymbols.info} `
        );

        printLog( logLinesWithFigure, 0 );
        logEol();
      } );
    }

    if ( memoryUsage ) {
      printLog( chalk.yellow( `Memory usage: ${memoryUsage}\n` ), 4 );
      logEol();
    }

  }

}
