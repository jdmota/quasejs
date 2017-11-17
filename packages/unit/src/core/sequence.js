/* @flow */

import isPromise from "./util/is-promise";
import skipReasons from "./skip-reasons";
import type { Status, IRunReturn, GenericRunnable, MinimalRunnable, MinimalTest, IRunnable, ITest } from "./interfaces";
import type { Runnable } from "./test";

class ProxyImpl<T: IRunnable, R: GenericRunnable<T>> {
  test: R;
  seq: SequenceImpl<T, R>;
  proxyFn: ( R, SequenceImpl<T, R> ) => IRunReturn<T>;
  constructor( test: R, seq: SequenceImpl<T, R>, proxyFn: ( R, SequenceImpl<T, R> ) => IRunReturn<T> ) {
    this.test = test;
    this.seq = seq;
    this.proxyFn = proxyFn;

    const _this: any = this;
    _this.run = this.run.bind( this );
    _this.runSkip = this.runSkip.bind( this );
  }
  run() {
    return this.proxyFn( this.test, this.seq );
  }
  runSkip( skipReason: ?string ) {
    return this.test.runSkip( skipReason );
  }
}

class Proxy extends ProxyImpl<IRunnable, MinimalRunnable> implements MinimalRunnable {}

class ClonableProxy extends ProxyImpl<ITest, MinimalTest> implements MinimalTest {
  clone( context: Object ): ClonableProxy {
    return new ClonableProxy( this.test.clone( context ), this.seq, this.proxyFn );
  }
}

class SequenceImpl<T: IRunnable, R: GenericRunnable<T>> implements IRunnable {

  tests: Array<R>;
  bail: boolean;
  isConcurrent: boolean;
  level: number;
  failedBecauseOfHook: ?{ level: number };
  skipReason: ?string;
  status: Status;
  failTest: boolean;
  skipTest: boolean;
  bailTestBecauseOfHook: boolean;

  constructor( bail: boolean, isConcurrent: boolean, level: number ) {
    this.tests = [];
    this.bail = bail;
    this.isConcurrent = isConcurrent;
    this.level = level;
    this.failedBecauseOfHook = null;
    this.skipReason = undefined;
    this.status = undefined;
    this.failTest = false;
    this.skipTest = false;
    this.bailTestBecauseOfHook = false;

    const _this: any = this;
    _this.addResult = this.addResult.bind( this );
    _this.getResult = this.getResult.bind( this );
    _this.run = this.run.bind( this );
    _this.runSkip = this.runSkip.bind( this );
  }

  getResult(): SequenceImpl<T, R> {
    this.status = this.failTest ? "failed" : this.skipTest ? "skipped" : "passed";
    if ( this.failTest ) {
      this.skipReason = undefined;
    }
    return this;
  }

  runSkip( reason: ?string ) {
    const tests = this.tests;
    this.skipReason = reason;
    for ( let i = 0; i < tests.length; i++ ) {
      this.addResult( tests[ i ].runSkip( reason ) );
    }
    return this.getResult();
  }

  run() {

    const tests = this.tests;

    for ( let i = 0; i < tests.length; i++ ) {

      let result = tests[ i ].run();

      if ( isPromise( result ) ) {

        if ( this.isConcurrent ) {

          let promises = [ result.then( this.addResult ) ];

          for ( let j = i + 1; j < tests.length; j++ ) {

            result = tests[ j ].run();

            if ( isPromise( result ) ) {
              promises.push( result.then( this.addResult ) );
            } else {
              this.addResult( result );
            }

          }

          return Promise.all( promises ).then( this.getResult );
        }

        result = result.then( this.addResult );

        for ( let j = i + 1; j < tests.length; j++ ) {
          result = result.then( tests[ j ].run ).then( this.addResult );
        }

        return result.then( this.getResult );

      }

      this.addResult( result );

    }

    return this.getResult();
  }

  updateFailedBecauseOfHook( result: T ) {
    if ( result.failedBecauseOfHook ) {
      if ( result.failedBecauseOfHook.level <= this.level ) {
        this.bailTestBecauseOfHook = true;
      }
      const failedBecauseOfHook = this.failedBecauseOfHook;
      if ( failedBecauseOfHook ) {
        failedBecauseOfHook.level = Math.min( failedBecauseOfHook.level, result.failedBecauseOfHook.level );
      } else {
        this.failedBecauseOfHook = { level: result.failedBecauseOfHook.level };
      }
    }
  }

  addResult( result: T ) { // eslint-disable-line
    throw new Error( "Abstract" );
  }

}

export class Sequence extends SequenceImpl<IRunnable, MinimalRunnable> implements IRunnable {

  static proxy( t: MinimalRunnable, seq: Sequence ) {
    if ( seq.bailTestBecauseOfHook ) {
      return t.runSkip( skipReasons.hookFailed );
    }
    if ( seq.failTest && seq.bail ) {
      return t.runSkip( skipReasons.bailed );
    }
    return t.run();
  }

  add( t: MinimalRunnable ) {
    this.tests.push( new Proxy( t, this, Sequence.proxy ) );
  }

  addResult( result: IRunnable ) {
    if ( result.status === "failed" ) {
      this.failTest = true;
      this.updateFailedBecauseOfHook( result );
    }
  }

}

export class InTestSequence extends SequenceImpl<ITest, MinimalTest> implements ITest {

  slow: boolean;
  metadata: Object;
  errors: Object[];
  assertions: Object[];
  runtime: number;
  middleRunnable: Runnable;
  middleRunnableProxy: ClonableProxy;

  constructor( level: number, metadata: Object, middleRunnable: Runnable ) {
    super( false, false, level );
    this.errors = [];
    this.assertions = [];
    this.status = undefined;
    this.runtime = 0;
    this.metadata = metadata;
    this.slow = false;
    this.middleRunnable = middleRunnable;
    this.middleRunnableProxy = new ClonableProxy( middleRunnable, this, InTestSequence.proxy );
  }

  static proxy( t: MinimalTest, seq: InTestSequence ) {
    if ( seq.bailTestBecauseOfHook ) {
      return t.runSkip( skipReasons.hookFailed );
    }
    if ( seq.skipTest ) {
      return t.runSkip( seq.skipReason );
    }
    return t.run();
  }

  clone( context: Object ) {
    const seq = new InTestSequence( this.level, this.metadata, this.middleRunnable.clone( context ) );
    this.tests.forEach( t => {
      if ( t === this.middleRunnableProxy ) {
        seq.pushMiddle();
      } else {
        seq.add( t.clone( context ) );
      }
    } );
    return seq;
  }

  add( t: MinimalTest ) {
    this.tests.push( t );
  }

  pushMiddle() {
    this.tests.push( this.middleRunnableProxy );
  }

  addResult( result: ITest ) {

    const metadata = result.metadata || {};

    if ( result.status === "failed" ) {
      this.failTest = true;
      this.updateFailedBecauseOfHook( result );
    } else if ( result.status === "skipped" && !metadata.skipped && metadata.type !== "afterEach" ) {
      this.skipTest = true;
      if ( !this.skipReason ) {
        this.skipReason = result.skipReason;
      }
    }

    if ( result.errors ) {
      result.errors.forEach( x => this.errors.push( x ) );
      result.assertions.forEach( x => this.assertions.push( x ) );
      this.runtime += result.runtime;
    }

    if ( result.slow === true ) {
      this.slow = true;
    }

  }

}

export class BeforeTestsAfterSequence extends SequenceImpl<IRunnable, MinimalRunnable> implements IRunnable {

  constructor( bail: boolean, level: number ) {
    super( bail, false, level );
  }

  static proxy( t: MinimalRunnable, seq: BeforeTestsAfterSequence ) {
    if ( seq.bailTestBecauseOfHook ) {
      return t.runSkip( skipReasons.hookFailed );
    }
    if ( seq.failTest && seq.bail ) {
      return t.runSkip( skipReasons.bailed );
    }
    if ( seq.skipTest ) {
      return t.runSkip( seq.skipReason );
    }
    return t.run();
  }

  add( t: MinimalRunnable, inMiddle: ?boolean ) {
    if ( inMiddle ) {
      this.tests.push( new Proxy( t, this, BeforeTestsAfterSequence.proxy ) );
    } else {
      this.tests.push( t );
    }
  }

  addResult( result: IRunnable ) {

    const metadata = result.metadata || {};

    if ( result.status === "failed" ) {
      this.failTest = true;
      this.updateFailedBecauseOfHook( result );
    } else if ( result.status === "skipped" && !metadata.skipped && metadata.type !== "after" ) {
      this.skipTest = true;
      if ( !this.skipReason ) {
        this.skipReason = result.skipReason;
      }
    }

  }

}
