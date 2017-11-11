/* @flow */

import { getStack } from "../../../error/src";
import defer from "../util/defer";
import isObservable from "../util/is-observable";
import isPromise from "../util/is-promise";
import observableToPromise from "../util/observable-to-promise";
import SkipError from "../util/skip-error";
import { assertTimeout, assertNumber, assertDelay } from "../util/assert-args";
import AssertionError from "./assertion-error";
import GlobalEnv from "./global-env";
import type { Status, IRunnable, ITest, IDeferred, IRunReturn } from "./interfaces";
import type Runner from "./runner";
import type Suite from "./suite";
import type { TestPlaceholder } from "./placeholders";
import { InTestSequence } from "./sequence";

export class Runnable implements ITest {

  name: ?string;
  parent: Suite;
  runner: Runner;
  status: Status;
  runtime: number;
  errors: Object[];
  assertions: Object[];
  slow: boolean;
  placeholder: TestPlaceholder;
  callback: Function;
  metadata: Object;
  context: Object;
  didPlan: boolean;
  planned: number;
  planStack: ?string;
  assertionCount: number;
  level: number;
  failedBecauseOfHook: ?{ level: number };
  skipReason: ?string;
  timeStart: number;
  timeoutId: any;
  maxRetries: number;
  retryDelayValue: number;
  maxTimeout: number;
  timeoutStack: ?string;
  minSlow: number;
  globalsCheck: ?GlobalEnv;
  finished: boolean;
  deferred: ?IDeferred<Runnable>;

  constructor( placeholder: TestPlaceholder, context: ?Object, parent: Suite ) {

    this.name = placeholder.name;
    this.parent = parent;
    this.runner = parent.runner;

    this.status = undefined;
    this.runtime = 0;
    this.errors = [];
    this.assertions = [];
    this.slow = false;

    this.placeholder = placeholder;

    this.callback = placeholder.callback;
    this.metadata = placeholder.metadata;
    this.context = context || {};

    this.didPlan = false;
    this.planned = 0;
    this.planStack = undefined;
    this.assertionCount = 0;

    this.level = placeholder.level;
    this.failedBecauseOfHook = null;
    this.skipReason = undefined;

    this.timeStart = 0;

    this.timeoutId = undefined;

    const parentPlaceholder = parent.placeholder;

    this.maxRetries = parentPlaceholder.maxRetries || 0;
    this.retryDelayValue = parentPlaceholder.retryDelayValue || 0;
    this.maxTimeout = parentPlaceholder.maxTimeout || 0;
    this.timeoutStack = parentPlaceholder.timeoutStack;
    this.minSlow = parentPlaceholder.minSlow || 0;

    this.globalsCheck = this.runner.options.noglobals ? new GlobalEnv() : null;

    this.finished = false;

    this.deferred = null;

    const _this: any = this;
    _this.run = this.run.bind( this );
    _this.runSkip = this.runSkip.bind( this );
    _this.exit = this.exit.bind( this );
    _this.exitError = this.exitError.bind( this );
    _this.exitTimeout = this.exitTimeout.bind( this );
  }

  clone( context: Object ) {
    if ( !context ) {
      throw new Error( ".clone() should receive new context" );
    }
    return new Runnable( this.placeholder, context, this.parent );
  }

  assertCall( name: string ) {
    if ( this.finished ) {
      this.addError( new Error( `You should not call .${name}() after the test has finished.` ) );
      return false;
    }
    return true;
  }

  plan( n: number ) {
    if ( this.assertCall( "plan" ) ) {
      assertNumber( n );
      this.didPlan = true;
      this.planned = n;
      this.planStack = getStack( 2 );
    }
  }

  incCount() {
    if ( this.assertCall( "incCount" ) ) {
      this.assertionCount++;
    }
  }

  skip( reason: ?string ) {
    if ( this.assertCall( "skip" ) ) {
      this.status = "skipped";
      throw new SkipError( reason );
    }
  }

  retries( n: number ) {
    if ( this.metadata.type !== "test" ) {
      throw new Error( ".retries() is not available for hooks" );
    }
    if ( this.assertCall( "retries" ) ) {
      if ( n === undefined ) {
        return this.maxRetries;
      }
      assertNumber( n );
      this.maxRetries = n;
    }
  }

  retryDelay( n: number ) {
    if ( this.metadata.type !== "test" ) {
      throw new Error( ".retryDelay() is not available for hooks" );
    }
    if ( this.assertCall( "retryDelay" ) ) {
      if ( n === undefined ) {
        return this.retryDelayValue;
      }
      assertDelay( n );
      this.retryDelayValue = n;
    }
  }

  timeout( n: number ) {
    if ( this.assertCall( "timeout" ) ) {
      if ( n === undefined ) {
        return this.maxTimeout;
      }
      assertTimeout( n );
      this.maxTimeout = n;
      this.timeoutStack = getStack( 2 );
    }
  }

  defineSlow( n: number ) {
    if ( this.assertCall( "slow" ) ) {
      if ( n === undefined ) {
        return this.minSlow;
      }
      assertNumber( n );
      this.minSlow = n;
    }
  }

  hasErrors() {
    return this.errors && this.errors.length;
  }

  addError( err: Object, stack: ?string ) {
    if ( this.finished ) {
      if ( this.status !== "failed" ) {
        this.runner.postError( err );
      }
      return;
    }
    if ( err instanceof SkipError || err.name === "SkipError" ) {
      this.skipReason = err.message;
      return;
    }
    if ( !err || typeof err !== "object" ) {
      err = new Error( err );
    }
    if ( stack ) {
      err.stack = stack;
    }
    this.errors.push( err );
    this.assertions.push( err );
  }

  checkPlanCount() {
    if ( this.hasErrors() ) {
      return;
    }
    if ( this.didPlan && this.planned !== this.assertionCount ) {
      this.addError(
        new AssertionError( {
          message: "Planned " + this.planned + " but " + this.assertionCount + " assertions were run."
        } ),
        this.planStack
      );
    } else if ( !this.didPlan && this.assertionCount === 0 && !this.metadata.allowNoPlan && this.metadata.type === "test" ) {
      this.addError(
        new AssertionError( {
          message: "No assertions were run."
        } ),
        this.placeholder.defaultStack
      );
    }
  }

  exitSkip( reason: ?string ) {
    this.status = "skipped";
    this.skipReason = reason;
    return this.exit();
  }

  exitTodo() {
    this.status = "todo";
    return this.exit();
  }

  exitTimeout() {
    this.addError( new Error( "Timeout exceeded." ), this.timeoutStack );
    return this.exit();
  }

  exitError( error: Object ) {
    this.addError( error );
    return this.exit();
  }

  exit() {
    if ( this.finished ) {
      return this;
    }

    if ( !this.status && this.globalsCheck ) {
      const e = this.globalsCheck.check();
      if ( e ) {
        this.addError( e );
      }
    }

    if ( this.errors.length ) {
      this.status = "failed";
    } else if ( !this.status ) {
      this.checkPlanCount();

      if ( this.errors.length ) {
        this.status = "failed";
      } else {
        this.status = "passed";
      }
    }

    this.finished = true;

    if ( this.timeStart ) {
      this.runtime = Date.now() - this.timeStart;
    }

    if ( this.timeoutId ) {
      clearTimeout( this.timeoutId );
    }

    this.slow = this.minSlow ? this.runtime >= this.minSlow : false;

    if ( this.status === "failed" && this.metadata.type !== "test" ) {
      this.failedBecauseOfHook = { level: this.level };
    }

    if ( this.deferred ) {
      this.deferred.resolve( this );
      this.deferred = null;
      return this;
    }

    return this;
  }

  runSkip( reason: ?string ) {
    return this.exitSkip( reason );
  }

  run() {

    let callback = this.callback;
    let error;
    let ret;

    if ( this.metadata.skipped ) {
      return this.exitSkip();
    }

    if ( this.metadata.todo ) {
      return this.exitTodo();
    }

    this.timeStart = Date.now();

    if ( this.globalsCheck ) {
      this.globalsCheck.start();
    }

    try {
      ret = callback( this.publicApi(), this.context );
    } catch ( e ) {
      error = e;
    }

    if ( error ) {
      return this.exitError( error );
    }

    if ( this.maxTimeout ) {
      this.timeoutId = setTimeout( this.exitTimeout, this.maxTimeout );
    }

    let promise;

    if ( isObservable( ret ) ) {
      promise = observableToPromise( ret );
    } else if ( isPromise( ret ) ) {
      promise = ret;
    }

    if ( promise ) {
      const d = this.deferred = defer();
      promise.then( this.exit, this.exitError );
      return d.promise;
    }

    return this.exit();

  }

  publicApi() {
    return {
      plan: this.plan.bind( this ),
      incCount: this.incCount.bind( this ),
      skip: this.skip.bind( this ),
      retries: this.retries.bind( this ),
      retryDelay: this.retryDelay.bind( this ),
      timeout: this.timeout.bind( this ),
      slow: this.defineSlow.bind( this )
    };
  }

}

export default class Test implements IRunnable {

  name: ?string;
  fullname: ( ?string )[];
  status: Status;
  runtime: number;
  suiteName: ?string;
  errors: Object[];
  assertions: Object[];
  slow: boolean;
  level: number;
  failedBecauseOfHook: ?{ level: number };
  skipReason: ?string;
  runnable: Runnable | InTestSequence;
  metadata: Object;
  runner: Runner;
  currentRetry: number;
  maxRetries: number;
  retryDelayValue: number;

  constructor( placeholder: TestPlaceholder, runnable: Runnable | InTestSequence, parent: Suite ) {

    this.name = placeholder.name;
    this.fullname = placeholder.fullname;

    this.status = undefined;

    this.runtime = 0;

    this.suiteName = parent.name;

    this.errors = [];
    this.assertions = [];

    this.slow = false;

    this.level = placeholder.level;
    this.failedBecauseOfHook = null;
    this.skipReason = undefined;

    parent.tests.push( this );

    this.runnable = runnable;
    this.metadata = placeholder.metadata;
    this.runner = parent.runner;

    this.currentRetry = 0;
    this.maxRetries = 0; // Gets defined after the first run
    this.retryDelayValue = 0; // Gets defined after the first run

    const _this: any = this;
    _this.run = this.run.bind( this );
    _this.runSkip = this.runSkip.bind( this );
    _this.end = this.end.bind( this );
  }

  start() {
    this.runner.testStart( this );
  }

  end(): IRunReturn<Test> {
    this.errors = this.runnable.errors;
    this.assertions = this.runnable.assertions;
    this.status = this.runnable.status;
    this.runtime = this.runnable.runtime;
    this.slow = this.runnable.slow;
    this.failedBecauseOfHook = this.runnable.failedBecauseOfHook;
    this.skipReason = this.runnable.skipReason;

    if ( this.metadata.failing ) {
      if ( this.status === "failed" ) {
        this.status = "passed";
        this.errors.length = 0;
      } else if ( this.status === "passed" ) {
        this.status = "failed";
        this.errors.push(
          new Error( "Test was expected to fail, but succeeded, you should stop marking the test as failing." )
        );
      }
    }

    if ( this.status === "failed" && !this.failedBecauseOfHook ) {
      if ( this.currentRetry === 0 ) { // Only set these after the first run
        const runnable = this.runnable;

        if ( runnable instanceof InTestSequence ) {
          this.maxRetries = runnable.middleRunnable.maxRetries;
          this.retryDelayValue = runnable.middleRunnable.retryDelayValue;
        } else {
          this.maxRetries = runnable.maxRetries;
          this.retryDelayValue = runnable.retryDelayValue;
        }
      }
      if ( this.currentRetry < this.maxRetries ) {
        this.currentRetry++;
        this.runnable = this.runnable.clone( {} );
        return new Promise( resolve => {
          setTimeout( () => resolve( this.runTry() ), this.retryDelayValue );
        } );
      }
    }

    this.runner.testEnd( this );
    return this;
  }

  runSkip( reason: ?string ) {
    this.start();
    this.runnable.runSkip( reason );
    return this.end();
  }

  runTry(): IRunReturn<Test> {
    const run = this.runnable.run();
    if ( isPromise( run ) ) {
      return run.then( this.end );
    }
    return this.end();
  }

  run() {
    this.start();
    return this.runTry();
  }

}
