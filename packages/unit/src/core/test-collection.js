// @flow

import type Suite from "./suite";
import { Sequence, InTestSequence, BeforeTestsAfterSequence } from "./sequence";
import { type Placeholder, TestPlaceholder, GroupPlaceholder } from "./placeholders";

export default class TestCollection {

  hasExclusive: boolean;
  fastBail: boolean;
  tests: {
    concurrent: Placeholder[],
    serial: Placeholder[]
  };
  hooks: {
    before: TestPlaceholder[],
    beforeEach: TestPlaceholder[],
    after: TestPlaceholder[],
    afterEach: TestPlaceholder[]
  };
  _hasUnskippedTests: ?boolean;

  constructor( fastBail: boolean ) {
    this.hasExclusive = false;
    this.fastBail = fastBail;
    this.tests = {
      concurrent: [],
      serial: []
    };
    this.hooks = {
      before: [],
      beforeEach: [],
      after: [],
      afterEach: []
    };
    this._hasUnskippedTests = undefined;
  }

  addTest( test: Placeholder, suite: GroupPlaceholder ) {

    let metadata = test.metadata;
    let type = metadata.type;

    if ( type !== "test" && type !== "group" ) {
      this.hooks[ type ].push( test );
      return;
    }

    if ( metadata.exclusive ) {
      suite.runner.onlyCount++;
    }

    // If .only() was used previously, only add .only() tests
    if ( this.hasExclusive && !metadata.exclusive ) {
      return;
    }

    if ( metadata.exclusive && !this.hasExclusive ) {
      this.tests.concurrent = [];
      this.tests.serial = [];
      this.hasExclusive = true;
    }

    if ( metadata.serial ) {
      this.tests.serial.push( test );
    } else {
      this.tests.concurrent.push( test );
    }

  }

  // They are returned in reverse order
  getBeforeEach( suite: Suite ) { // eslint-disable-line class-methods-use-this

    const hooks = [];
    let p = suite.placeholder;

    while ( p && p.collection ) {
      const beforeEach = p.collection.hooks.beforeEach;
      for ( let i = beforeEach.length - 1; i >= 0; i-- ) {
        hooks.push( beforeEach[ i ] );
      }
      p = p.parent;
    }

    return hooks;
  }

  // They are returned in correct order
  getAfterEach( suite: Suite ) { // eslint-disable-line class-methods-use-this

    const hooks = [];
    let p = suite.placeholder;

    while ( p && p.collection ) {
      const afterEach = p.collection.hooks.afterEach;
      for ( let i = 0; i < afterEach.length; i++ ) {
        hooks.push( afterEach[ i ] );
      }
      p = p.parent;
    }

    return hooks;
  }

  buildTest( test: Placeholder, suite: Suite ) {

    if ( test instanceof GroupPlaceholder ) {
      return test.build( suite );
    }

    if ( test.metadata.skipped || test.metadata.todo ) {
      return test.build( test.buildRunnable( {}, suite ), suite );
    }

    const context = {};
    const seq = new InTestSequence( suite.level, test.metadata, test.buildRunnable( context, suite ) );

    const beforeEachHooks = this.getBeforeEach( suite );
    for ( let i = beforeEachHooks.length - 1; i >= 0; i-- ) {
      seq.add( beforeEachHooks[ i ].buildRunnable( context, suite ) );
    }

    seq.pushMiddle();

    const afterEachHooks = this.getAfterEach( suite );
    for ( let i = 0; i < afterEachHooks.length; i++ ) {
      seq.add( afterEachHooks[ i ].buildRunnable( context, suite ) );
    }

    return test.build( seq, suite );
  }

  buildTestSeq( array: Placeholder[], isConcurrent: boolean, suite: Suite ) {

    if ( array.length === 1 ) {
      return this.buildTest( array[ 0 ], suite );
    }

    let seq = new Sequence( this.fastBail, isConcurrent, suite.level );

    for ( let i = 0; i < array.length; i++ ) {
      seq.add( this.buildTest( array[ i ], suite ) );
    }

    return seq;

  }

  hasUnskippedTests() {
    if ( this._hasUnskippedTests == null ) {
      this._hasUnskippedTests = this.tests.serial.concat( this.tests.concurrent )
        .some( test => {
          const skipped = test.metadata && test.metadata.skipped === true;
          if ( !skipped && test instanceof GroupPlaceholder ) {
            return test.collection.hasUnskippedTests();
          }
          return !skipped;
        } );
    }
    return this._hasUnskippedTests;
  }

  // Use sequences to:
  // 1. Run the beforeEach hooks, the test and the afterEach hooks
  // 2. Run the before hooks, a collection of tests and the after hooks

  // Returns a sequence
  build( suite: Suite ): BeforeTestsAfterSequence {

    const serial = this.tests.serial;
    const concurrent = this.tests.concurrent;
    const before = this.hooks.before;
    const after = this.hooks.after;
    const seq = new BeforeTestsAfterSequence( this.fastBail, suite.level );

    const runBeforeAfter = this.hasUnskippedTests();

    if ( runBeforeAfter ) {
      for ( let i = 0; i < before.length; i++ ) {
        seq.add( before[ i ].build( before[ i ].buildRunnable( null, suite ), suite ) );
      }
    }

    if ( serial.length ) {
      seq.add( this.buildTestSeq( serial, false, suite ), true );
    }

    if ( concurrent.length ) {
      seq.add( this.buildTestSeq( concurrent, true, suite ), true );
    }

    if ( runBeforeAfter ) {
      for ( let i = 0; i < after.length; i++ ) {
        seq.add( after[ i ].build( after[ i ].buildRunnable( null, suite ), suite ) );
      }
    }

    return seq;

  }

}
