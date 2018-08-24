import skipReasons from "../../core/skip-reasons";
import { log, log as printLog, logEol, indentString } from "./log";

const turbocolor = require( "turbocolor" );
const logSymbols = require( "log-symbols" );
const ora = require( "ora" );
const codeFrameColumns = require( "@babel/code-frame" ).codeFrameColumns;
const { prettify } = require( "@quase/path-url" );

export default class NodeReporter {

  constructor( runner ) {
    this.runner = runner;
    this.spinner = null;
    this.pendingTests = new Set();
    this.tests = [];
    this.otherErrors = [];
    this.ended = false;
    this.didAfterRun = false;
    this.interrupted = false;
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

      if ( this.interrupted ) {
        log( `\n${turbocolor.bold.red( "Interrupted." )}\n\n` );
      }

      if ( process.exitCode ) {
        log( turbocolor.bold.red( "Exit code: " + process.exitCode ) );
      } else {
        log( turbocolor.bold.green( "Exit code: 0" ) );
      }
      logEol();
    } );

    runner.on( "start", () => {
      NodeReporter.showConcurrency( runner );
      NodeReporter.showDebuggers( runner );

      this.spinner = ora( `Waiting for "runStart"...` ).start();
    } );

    runner.on( "sigint", _try => {
      this.interrupted = true;

      if ( this.spinner ) {
        this.spinner.stop();
      }
      log( `\nStopping tests... (${_try} try)\n` );
    } );

    runner.on( "why-is-running", async why => {
      log( `\n${turbocolor.bold.red( "Resources still running in child process..." )}\n` );

      for ( const { type, stack } of why ) {
        log( `\n${type}\n` );
        await this.logDefaultByStack( stack );
      }
      logEol();
    } );
  }

  static showOptions( options ) {
    logEol();
    log( turbocolor.bold.green( "Patterns: " ) + options.files.join( " " ) + "\n" );
    if ( options.ignore.length > 0 ) {
      log( turbocolor.bold.green( "Ignore patterns: " ) + options.ignore.join( " " ) + "\n" );
    }
    logEol();
  }

  static showFilesCount( count ) {
    log( turbocolor.bold.green( "Files count: " ) + count + "\n" );
    logEol();
  }

  static showSeed( runner ) {
    if ( runner.options.random ) {
      log( turbocolor.bold.yellow( "Random seed: " ) + runner.options.random + "\n" );
      logEol();
    }
  }

  static showConcurrency( runner ) {
    log( turbocolor.bold.green( "Child processes: " ) + runner.forks.length + "\n" );
    logEol();
  }

  static showDebuggers( { debuggersPromises, division } ) {
    if ( !debuggersPromises.length ) {
      return;
    }
    Promise.all( debuggersPromises ).then( debuggers => {
      log( turbocolor.bold.yellow( "Debugging" ) );
      logEol();
      log( turbocolor.bold.yellow( "Got to chrome://inspect or check https://nodejs.org/en/docs/inspector" ) );
      logEol();
      for ( let i = 0; i < debuggers.length; i++ ) {
        log( turbocolor.bold( debuggers[ i ] ), 4 );
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
    log( turbocolor.bold.red( error ) );
    logEol();
  }

  async logOtherErrors() {
    const otherErrors = this.otherErrors;
    this.otherErrors = [];

    if ( otherErrors.length > 0 ) {
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

      const tests = await Promise.all( this.tests );
      this.tests = null; // Prevent memory leaks

      const sortedTests = tests.sort( ( a, b ) => {
        if ( !a.source || !a.source.file ) {
          return 1;
        }
        if ( !b.source || !b.source.file ) {
          return -1;
        }
        const fileCompare = a.source.file.localeCompare( b.source.file );
        if ( fileCompare === 0 ) {
          const lineCompare = a.source.line - b.source.line;
          if ( lineCompare === 0 ) {
            return a.source.column - b.source.column;
          }
          return lineCompare;
        }
        return fileCompare;
      } );

      for ( let i = 0; i < sortedTests.length; i++ ) {
        await this.logTestEnd( sortedTests[ i ] ); // eslint-disable-line no-await-in-loop
      }

      const hasPending = t.pendingTests && t.pendingTests.size > 0;

      // If we had pending tests, don't trust the stats
      if ( t.runStartNotEmitted || hasPending ) {

        if ( t.runStartNotEmitted ) {
          log( `\n${turbocolor.bold.red( `${t.runStartNotEmitted} forks did not emit "runStart" event.` )}\n` );
        }

        if ( hasPending ) {
          log( `\n${turbocolor.bold.red( `${t.pendingTests.size} Pending tests:` )}\n` );

          for ( const stack of t.pendingTests ) {
            await this.logDefaultByStack( stack );
          }
        }

      } else {

        const { passed, skipped, todo, failed, total } = t.testCounts;

        let lines;

        if ( total === 0 ) {
          lines = [
            turbocolor.red( "\n  The total number of tests was 0." )
          ];
        } else {
          lines = [
            passed > 0 ? "\n  " + turbocolor.green( passed + " passed" ) : "",
            skipped > 0 ? "\n  " + turbocolor.yellow( skipped + " skipped" ) : "",
            todo > 0 ? "\n  " + turbocolor.blue( todo + " todo" ) : "",
            failed > 0 ? "\n  " + turbocolor.red( failed + " failed" ) : "",
            "\n\n  " + turbocolor.gray( t.runtime + " ms" ),
            t.onlyCount ? `\n\n  The '.only' modifier was used ${t.onlyCount} time${t.onlyCount === 1 ? "" : "s"}.` : ""
          ].filter( Boolean );
        }

        if ( this.runner.options.only ) {
          lines.push( "\n  --only option was used." );
        }

        if ( this.runner.options.bail ) {
          lines.push( "\n  --bail option was used." );
        }

        if ( t.snapshotStats ) {
          this.showSnapshotStats( lines, t.snapshotStats );
        }

        process.stdout.write( lines.join( "" ) + "\n" );

      }

      log( `\n${turbocolor.gray( `[${new Date().toLocaleTimeString()}]` )}\n\n` );

      await this.logOtherErrors();

      this.ended = true;

      const debuggersWaitingPromises = this.runner.debuggersWaitingPromises;

      if ( debuggersWaitingPromises.length ) {
        Promise.race( debuggersWaitingPromises ).then( () => {
          log(
            turbocolor.bold.yellow( "At least 1 of " + debuggersWaitingPromises.length + " processes are waiting for the debugger to disconnect...\n" )
          );
          logEol();
        } );
      }

    } );
  }

  showSnapshotStats( lines, { added, updated, removed, obsolete } ) {
    if ( added || updated || removed || obsolete ) {
      lines.push( turbocolor.blue( "\n\n  Snapshots" ) );
    }
    if ( added ) {
      lines.push( turbocolor.green( `\n    Added: ${added}` ) );
    }
    if ( updated ) {
      lines.push( turbocolor.green( `\n    Updated: ${updated}` ) );
    }
    if ( removed ) {
      lines.push( turbocolor.red( `\n    Removed: ${removed}` ) );
    }
    if ( obsolete ) {
      lines.push( turbocolor.red( `\n    Obsolete: ${obsolete}` ) );
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
    this.pendingTests.delete( t.fullname.join( " > " ) );
    this.updateSpinner();

    this.tests.push( ( async() => {
      const { source } = await this.runner.beautifyStack( t.defaultStack );
      t.source = source;
      return t;
    } )() );
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
      const { stack, source } = await this.runner.beautifyStack( original.stack );
      err.stack = stack;
      err.source = source;
    }

    return err;
  }

  showSource( source ) {

    const { file, code, line, column } = source;

    if ( !file || !code ) {
      if ( file ) {
        return `${turbocolor.gray( `${prettify( file )}:${line}:${column}` )}\n`;
      }
      return "";
    }

    const codeFrameOptions = this.runner.options.codeFrameOptions;
    const frame = this.runner.options.codeFrame ?
      codeFrameColumns( code, { start: { line } }, codeFrameOptions ) + "\n\n" :
      "";

    return `${turbocolor.gray( `${prettify( file )}:${line}:${column}` )}\n\n${frame}`;
  }

  async logDefaultByStack( defaultStack ) {
    const { source } = await this.runner.beautifyStack( defaultStack );
    this.logDefault( source );
  }

  logDefault( source ) {
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
      log += turbocolor.bold( error.message ) + "\n";
    }

    if ( error.source ) {
      log += this.showSource( error.source );
    }

    if ( diff && error.diff ) {
      log += `${this.makeLegend()}\n\n${indentString( error.diff )}\n\n`;
    }

    if ( stack && error.stack ) {
      log += turbocolor.gray( error.stack ) + "\n\n";
    }

    printLog( log, 4 );
  }

  async logTestEnd( { fullname, status, skipReason, errors, runtime, slow, logs, source, memoryUsage } ) {

    if ( !this.runner.options.verbose || !logs.length ) {
      if ( status === "passed" && !slow ) {
        return;
      }
      if ( skipReason === skipReasons.bailed ) {
        return;
      }
      if ( skipReason === skipReasons.interrupted ) {
        return;
      }
    }

    const statusText = status === "failed" ? turbocolor.red( status ) : status === "passed" ? turbocolor.green( status ) : turbocolor.yellow( status );

    printLog( `\n${turbocolor.bold( fullname.join( " > " ) )}\n${statusText} | ${runtime} ms ${slow ? turbocolor.yellow( "Slow!" ) : ""}\n` );

    if ( skipReason ) {
      printLog( `\nSkip reason: ${skipReason}`, 4 );
    }

    if ( errors.length ) {
      for ( let i = 0; i < errors.length; i++ ) {
        await this.logError( errors[ i ] ); // eslint-disable-line no-await-in-loop
      }
    } else {
      this.logDefault( source );
    }

    if ( logs.length ) {

      printLog( "Logs:\n\n", 4 );

      logs.forEach( log => {
        const logLines = indentString( turbocolor.gray( log ), 6 );
        const logLinesWithFigure = logLines.replace(
          /^ {6}/,
          `    ${logSymbols.info} `
        );

        printLog( logLinesWithFigure, 0 );
        logEol();
      } );
    }

    if ( memoryUsage ) {
      printLog( turbocolor.yellow( `Memory usage: ${memoryUsage}\n` ), 4 );
      logEol();
    }

  }

}
