import { testEnd, logError } from "./node-test-end";
import colors from "./colors";

const ora = require( "ora" );

export default class NodeReporter {

  constructor( runner ) {
    this.spinner = null;
    this.tests = [];
    this.postErrors = [];
    this.ended = false;
    this.didAfterRun = false;
    runner.on( "runStart", this.runStart.bind( this ) );
    runner.on( "testEnd", this.testEnd.bind( this ) );
    runner.on( "runEnd", this.runEnd.bind( this ) );
    runner.on( "postError", err => {
      if ( this.ended ) {
        this.afterRun();
        logError( err );
      } else {
        this.postErrors.push( err );
      }
    } );
  }

  afterRun() {
    if ( !this.didAfterRun ) {
      this.didAfterRun = true;
      process.stdout.write( "\n  Errors after the test has finished:\n" );
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

      process.exitCode = failed || !total || this.postErrors.length ? 1 : 0;

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

      if ( this.postErrors.length > 0 ) {
        this.afterRun();
        for ( let i = 0; i < this.postErrors.length; i++ ) {
          await logError( this.postErrors[ i ] ); // eslint-disable-line no-await-in-loop
        }
        this.postErrors = null; // Prevent memory leaks
      }

    } );
  }

  testEnd( t ) {
    this.tests.push( t );
  }

}