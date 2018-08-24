import { GroupPlaceholder } from "./placeholders";
import { createTestChain } from "./chain";
import validateOptions from "./validate-options";

const { EventEmitter } = require( "events" );
const concordance = require( "concordance" );

class Runner extends EventEmitter {

  constructor( _opts ) {
    super();

    this.options = validateOptions( Object.assign( {}, _opts ) );
    this.globals = this.options.globals;
    this.updateSnapshots = this.options.updateSnapshots;
    this.concordanceOptions = this.options.concordanceOptions;
    this.randomizer = this.options.randomizer;
    this.match = this.options.match;
    this.assertions = Object.assign( {}, ...this.options.assertions );

    this.failedOnce = false;
    this.sentSigint = false;
    this.onlyCount = 0;
    this.promises = [];

    this.root = new GroupPlaceholder(
      "",
      undefined,
      {
        type: "group",
        strict: this.options.strict,
        allowNoPlan: this.options.allowNoPlan
      },
      {
        runner: this,
        level: 0,
        maxRetries: 0,
        retryDelayValue: 0,
        maxTimeout: this.options.timeout,
        timeoutStack: null,
        minSlow: this.options.slow,
        randomizationAllowed: true,
        serialForced: this.options.forceSerial
      },
      true
    );

    this.test = createTestChain( this );

    this._current = this.root;
    this.suite = null;

    this.run = this.run.bind( this );
  }

  static init( options ) {
    return new Runner( options );
  }

  format( value ) {
    return concordance.format( value, this.concordanceOptions );
  }

  otherError( err ) {
    this.emit( "otherError", err );
  }

  delaySetup( promise ) {
    this.promises.push( promise );
  }

  listen() {
    const array = [];
    this.on( "runStart", t => array.push( "runStart", t ) );
    this.on( "testStart", t => array.push( "testStart", t ) );
    this.on( "testEnd", t => array.push( "testEnd", t ) );
    this.on( "suiteStart", t => array.push( "suiteStart", t ) );
    this.on( "suiteEnd", t => array.push( "suiteEnd", t ) );
    this.on( "runEnd", t => array.push( "runEnd", t ) );
    return array;
  }

  run() {
    return Promise.all( this.promises ).then( () => {
      this.suite = this.root.build();
      this.runStart();
      return Promise.resolve( this.suite.run() ).then( () => {
        this.runEnd();
      } );
    } );
  }

  shouldBail() {
    return this.failedOnce && this.options.bail;
  }

  shouldInterrupt() {
    return this.sentSigint;
  }

  runStart() {
    this.emit( "runStart", {
      name: this.suite.name,
      fullname: this.suite.fullname,
      tests: this.suite.tests,
      childSuites: this.suite.childSuites,
      testCounts: {
        passed: undefined,
        failed: undefined,
        skipped: undefined,
        todo: undefined,
        total: this.suite.testCounts.total
      }
    } );
  }

  runEnd() {
    this.emit( "runEnd", {
      name: this.suite.name,
      fullname: this.suite.fullname,
      status: this.suite.status,
      runtime: this.suite.runtime,
      testCounts: Object.assign( {}, this.suite.testCounts ),
      onlyCount: this.onlyCount
    } );
  }

  suiteStart( suite ) {
    if ( suite.name ) {
      this.emit( "suiteStart", {
        name: suite.name,
        fullname: suite.fullname,
        tests: suite.tests,
        childSuites: suite.childSuites,
        defaultStack: suite.placeholder.defaultStack,
        testCounts: {
          passed: undefined,
          failed: undefined,
          skipped: undefined,
          todo: undefined,
          total: suite.testCounts.total
        }
      } );
    }
  }

  suiteEnd( suite ) {
    if ( suite.name ) {
      this.emit( "suiteEnd", {
        name: suite.name,
        fullname: suite.fullname,
        tests: suite.tests,
        childSuites: suite.childSuites,
        status: suite.status,
        runtime: suite.runtime,
        defaultStack: suite.placeholder.defaultStack,
        testCounts: Object.assign( {}, suite.testCounts )
      } );
    }
  }

  testStart( test ) {
    this.emit( "testStart", {
      name: test.name,
      suiteName: test.suiteName,
      fullname: test.fullname,
      defaultStack: test.placeholder.defaultStack
    } );
  }

  testEnd( test ) {
    this.emit( "testEnd", {
      name: test.name,
      fullname: test.fullname,
      suiteName: test.suiteName,
      status: test.status,
      errors: test.errors,
      logs: test.logs,
      runtime: test.runtime,
      skipReason: test.skipReason,
      slow: test.slow,
      assertions: test.assertions,
      defaultStack: test.placeholder.defaultStack,
      memoryUsage: test.memoryUsage
    } );

    if ( test.status === "failed" ) {
      this.failedOnce = true;
    }
  }

  matchesSnapshot( something, stack, key, deferred ) {
    this.emit( "matchesSnapshot", {
      something,
      stack,
      key,
      deferred
    } );
  }

}

export default Runner;
