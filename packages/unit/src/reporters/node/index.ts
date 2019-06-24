import turbocolor from "turbocolor";
import logSymbols from "log-symbols";
import ora from "ora";
import { codeFrameColumns } from "@babel/code-frame";
import { prettify } from "@quase/path-url";
import skipReasons from "../../core/skip-reasons";
import { TestEnd, RunEnd, SnapshotStats, TestStart, EventAskSourceContent } from "../../types";
import { log, log as printLog, logEol, indentString } from "./log";
import { NodeRunner } from "../../node-runner";

export default class NodeReporter {

  private runner: NodeRunner;
  private spinner: ora.Ora | null;
  private pendingTests: Set<string>;
  private tests: Promise<TestEnd>[];
  private otherErrors: any[];
  private ended: boolean;
  private didAfterRun: boolean;
  private interrupted: boolean;

  constructor( runner: NodeRunner ) {
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

    runner.on( "global-timeout", () => {
      this.getSpinner().stop();

      log( `\n${turbocolor.bold.red( "Global timeout!" )}\n\n` );
    } );

    runner.on( "exit", async() => {
      this.getSpinner().stop();

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
        await this.logDefault( stack );
      }
      logEol();
    } );
  }

  static showOptions( options: any ) {
    logEol();
    log( turbocolor.bold.green( "Patterns: " ) + options.files.join( " " ) + "\n" );
    if ( options.ignore.length > 0 ) {
      log( turbocolor.bold.green( "Ignore patterns: " ) + options.ignore.join( " " ) + "\n" );
    }
    logEol();
  }

  static showFilesCount( count: number, time: number ) {
    log( `${turbocolor.bold.green( `Found ${count} files` )} in ${time} ms\n` );
    logEol();
  }

  static showSeed( runner: NodeRunner ) {
    if ( runner.options.random ) {
      log( turbocolor.bold.yellow( "Random seed: " ) + runner.options.random + "\n" );
      logEol();
    }
  }

  static showConcurrency( runner: NodeRunner ) {
    log( turbocolor.bold.green( "Child processes: " ) + runner.forks.length + "\n" );
    logEol();
  }

  static showDebuggers( runner: NodeRunner ) {
    if ( !runner.debuggersPromises.length ) {
      return;
    }
    Promise.all( runner.debuggersPromises ).then( debuggers => {
      log( turbocolor.bold.yellow( "Debugging" ) );
      logEol();
      log( turbocolor.bold.yellow( "Got to chrome://inspect or check https://nodejs.org/en/docs/inspector" ) );
      logEol();
      for ( let i = 0; i < debuggers.length; i++ ) {
        log( turbocolor.bold( debuggers[ i ] ), 4 );
        logEol();
        for ( const file of runner.division[ i ] ) {
          log( prettify( file ), 6 );
          logEol();
        }
      }
      logEol();
    } );
  }

  static fatalError( error: string ) {
    process.exitCode = 1;
    logEol();
    log( turbocolor.bold.red( error ) );
    logEol();
  }

  getSpinner() {
    const { spinner } = this;
    if ( spinner ) {
      return spinner;
    }
    throw new Error( `No spinner` );
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

  static init( runner: NodeRunner ) {
    return new NodeReporter( runner );
  }

  runStart() {
    this.getSpinner().text = "Running tests...";
  }

  runEnd( t: RunEnd ) {
    setTimeout( async() => {

      this.getSpinner().stop();

      const tests = await Promise.all( this.tests );
      this.tests = []; // Prevent memory leaks

      const sortedTests = tests.sort( ( a, b ) => {
        if ( !a.source || !a.source.file ) {
          return 1;
        }
        if ( !b.source || !b.source.file ) {
          return -1;
        }
        const fileCompare = a.source.file.localeCompare( b.source.file );
        if ( fileCompare === 0 ) {
          if ( !a.source.line || !b.source.line ) {
            return 0;
          }
          const lineCompare = a.source.line - b.source.line;
          if ( lineCompare === 0 ) {
            if ( !a.source.column || !b.source.column ) {
              return 0;
            }
            return a.source.column - b.source.column;
          }
          return lineCompare;
        }
        return fileCompare;
      } );

      for ( let i = 0; i < sortedTests.length; i++ ) {
        await this.logTestEnd( sortedTests[ i ] ); // eslint-disable-line no-await-in-loop
      }

      const notStartedForks = t.notStartedForks;
      const hasPending = t.pendingTests && t.pendingTests.size > 0;

      // If we had pending tests, don't trust the stats
      if ( notStartedForks.length > 0 || hasPending ) {

        if ( notStartedForks.length > 0 ) {
          log( `\n${turbocolor.bold.red(
            `${notStartedForks.length} child ${notStartedForks.length === 1 ? "process" : "processes"}` +
            ` did not emit "runStart" event.`
          )}\n` );
          log( `\nPossible causes:\n` );

          for ( const { didCrash, notImportedFiles } of notStartedForks ) {
            if ( didCrash || notImportedFiles.size === 0 ) {
              log( `  - Some error during setup. See below.\n` );
            } else {
              for ( const file of notImportedFiles ) {
                log( `  - Infinite loop in ${prettify( file )}\n` );
                break; // Only show the first one, since files are imported by order
              }
            }
          }
        }

        if ( hasPending ) {
          log( `\n${turbocolor.bold.red( `${t.pendingTests.size} Pending tests:` )}\n` );

          for ( const stack of t.pendingTests ) {
            await this.logDefault( stack );
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

  showSnapshotStats( lines: string[], { added, updated, removed, obsolete }: SnapshotStats ) {
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
    const spinner = this.getSpinner();
    for ( const text of this.pendingTests ) {
      spinner.text = text;
      return;
    }
    spinner.text = "Waiting...";
  }

  testStart( t: TestStart ) {
    this.pendingTests.add( t.fullname.join( " > " ) );
    if ( this.pendingTests.size === 1 ) {
      this.updateSpinner();
    }
  }

  testEnd( t: TestEnd ) {
    this.pendingTests.delete( t.fullname.join( " > " ) );
    this.updateSpinner();

    this.tests.push( ( async() => {
      const { source } = await this.runner.beautifyStack( t.defaultStack );
      t.source = source;
      return t;
    } )() );
  }

  async enhanceError( original: any ): Promise<any> {

    const err: any = {
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

  showSource( source: EventAskSourceContent ) {

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

  async logDefault( defaultStack: string, source?: EventAskSourceContent | null ) {
    if ( !source ) {
      source = ( await this.runner.beautifyStack( defaultStack ) ).source;
    }

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

  async logError( e: any ) {

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

  async logTestEnd( { defaultStack, fullname, status, skipReason, errors, runtime, slow, logs, memoryUsage, source }: TestEnd ) {

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
      await this.logDefault( defaultStack, source );
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
