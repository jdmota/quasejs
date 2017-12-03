import colors from "./colors";
import { log, log as printLog, logEol, indentString } from "./log";

const chalk = require( "chalk" );
const ora = require( "ora" );
const codeFrameColumns = require( "babel-code-frame" ).codeFrameColumns;
const SourceMapExtractor = require( require.resolve( "@quase/source-map" ).replace( "index.js", "extractor.js" ) ).default;
const FileSystem = require( "@quase/memory-fs" ).default;
const { beautify: beautifyStack } = require( "@quase/error" );
const { prettify } = require( "@quase/path-url" );

const legend = colors.removed ? `${colors.removed( "- Expected" )} ${colors.added( "+ Actual" )}` : "";

export default class NodeReporter {

  constructor( runner ) {
    this.runner = runner;
    this.extractor = new SourceMapExtractor( new FileSystem() );
    this.spinner = null;
    this.tests = [];
    this.otherErrors = [];
    this.ended = false;
    this.didAfterRun = false;
    runner.on( "runStart", this.runStart.bind( this ) );
    runner.on( "testEnd", this.testEnd.bind( this ) );
    runner.on( "runEnd", this.runEnd.bind( this ) );
    runner.on( "otherError", err => {
      this.otherErrors.push( err );
      if ( this.ended ) {
        this.logOtherErrors();
      }
    } );
    runner.on( "exit", async() => {
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
  }

  static showFilesCount( count ) {
    logEol();
    log( chalk.bold.green( "Files count: " ) + count + "\n" );
    logEol();
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
    this.spinner = ora( "Running tests..." ).start();
  }

  runEnd( t ) {
    setTimeout( async() => {

      this.spinner.stop();

      for ( let i = 0; i < this.tests.length; i++ ) {
        await this.logTestEnd( this.tests[ i ] ); // eslint-disable-line no-await-in-loop
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
          log( chalk.bold.yellow( "At least 1 of " + debuggersWaitingPromises.length + " processes are waiting for the debugger to disconnect...\n" ) );
          logEol();
        } );
      }

    } );
  }

  testEnd( t ) {
    this.tests.push( t );
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

  async logError( e ) {

    const error = await this.enhanceError( e );
    let log = "\n";

    if ( error.message ) {
      log += colors.title( error.message ) + "\n";
    }

    if ( error.source ) {
      log += this.showSource( error.source );
    }

    if ( error.diff ) {
      log += `${legend}\n\n${indentString( error.diff )}\n\n`;
    }

    if ( error.stack ) {
      log += colors.errorStack( error.stack ) + "\n\n";
    }

    printLog( log, 4 );
  }

  async logTestEnd( { fullname, status, skipReason, errors, runtime, slow, defaultStack } ) {

    if ( status === "passed" && !slow ) {
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
    }

  }

}
