import { assertTimeout, assertNumber } from "./util/assert-args";
import requirePlugin from "./util/require-plugin";
import { color as concordanceOptions, plain as plainConcordanceOptions } from "./concordance-options";
import { GroupPlaceholder } from "./placeholders";
import randomizer from "./random";
import addChain from "./add-chain";

const { EventEmitter } = require( "events" ); // TODO for browser

class Runner extends EventEmitter {

  constructor( options ) {
    super();
    options = options || {};

    this.color = options.color === undefined ? true : !!options.color;
    this.noglobals = !!options.noglobals;
    this.updateSnapshots = !!options.updateSnapshots;

    const assertions = ( options.assertions || [] ).map( a => requirePlugin( a, null, "object", "assertion" ) );
    this.assertions = Object.assign( {}, ...assertions );

    this.concordanceOptions = requirePlugin(
      options.concordanceOptions,
      this.color ? concordanceOptions : plainConcordanceOptions,
      "object",
      "concordance options"
    );

    if ( options.timeout != null ) {
      assertTimeout( options.timeout );
    }

    if ( options.slow != null ) {
      assertNumber( options.slow );
    }

    this.randomizer = randomizer( options.seed );

    this.onlyCount = 0;
    this.promises = [];

    this.root = new GroupPlaceholder(
      undefined,
      undefined,
      {
        type: "group",
        fastBail: !!( options.bail || options.fastBail || options.failFast ),
        strict: !!options.strict,
        allowNoPlan: !!options.allowNoPlan
      },
      {
        runner: this,
        level: 0,
        maxRetries: 0,
        retryDelayValue: 0,
        maxTimeout: options.timeout || 0,
        timeoutStack: null,
        minSlow: options.slow || 0
      },
      true
    );

    this._current = this.root;
    this.suite = null;

    this.run = this.run.bind( this );
  }

  static init( options ) {
    return new Runner( options );
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
        testCounts: Object.assign( {}, suite.testCounts )
      } );
    }
  }

  testStart( test ) {
    this.emit( "testStart", {
      name: test.name,
      suiteName: test.suiteName,
      fullname: test.fullname,
    } );
  }

  testEnd( test ) {
    this.emit( "testEnd", {
      name: test.name,
      fullname: test.fullname,
      suiteName: test.suiteName,
      status: test.status,
      errors: test.errors,
      runtime: test.runtime,
      skipReason: test.skipReason,
      slow: test.slow,
      assertions: test.assertions,
      defaultStack: test.placeholder.defaultStack
    } );
  }

}

addChain( Runner );

export default Runner;
