import { getStack } from "@quase/error";
import { Status, IRunnable, ITest, ITestResult, Deferred, IRunReturn, TestMetadata, PublicTestApi, NumOrVoid, TestStart, TestEnd } from "../types";
import defer from "./util/defer";
import isObservable from "./util/is-observable";
import isPromise from "./util/is-promise";
import observableToPromise from "./util/observable-to-promise";
import SkipError from "./util/skip-error";
import { assertTimeout, assertNumber, assertDelay } from "./util/assert-args";
import GlobalEnv from "./global-env";
import Runner from "./runner";
import Suite from "./suite";
import { TestPlaceholder } from "./placeholders";
import { InTestSequence } from "./sequence";
import { ContextRef } from "./context";

export class Runnable implements ITestResult, ITest {

  name: string;
  fullname: string[];
  parent: Suite;
  runner: Runner;
  status: Status | undefined;
  runtime: number;
  errors: any[];
  assertions: any[];
  slow: boolean;
  logs: string[];
  placeholder: TestPlaceholder;
  callback: Function;
  metadata: TestMetadata;
  didPlan: boolean;
  planned: number;
  planStack: string | undefined;
  assertionCount: number;
  level: number;
  failedBecauseOfHook: { level: number } | null;
  skipReason: string | undefined;
  globalsCheck: GlobalEnv;
  finished: boolean;
  deferred: Deferred<void> | null;
  timeStart: number;
  timeoutId: any;

  maxTimeout: number;
  timeoutStack: string | undefined;
  minSlow: number;

  maxRetries: number;
  retryDelayValue: number;

  reruns: number;
  rerunDelayValue: number;

  snapshotsWaiting: Deferred<any>[];

  constructor( placeholder: TestPlaceholder, parent: Suite ) {

    this.name = placeholder.name;
    this.fullname = placeholder.fullname;
    this.parent = parent;
    this.runner = parent.runner;

    this.status = undefined;
    this.runtime = 0;
    this.errors = [];
    this.assertions = [];
    this.slow = false;

    this.logs = [];

    this.placeholder = placeholder;

    this.callback = placeholder.callback;
    this.metadata = placeholder.metadata;

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
    this.reruns = parentPlaceholder.reruns || 0;
    this.rerunDelayValue = parentPlaceholder.rerunDelayValue || 0;

    this.maxTimeout = parentPlaceholder.maxTimeout || 0;
    this.timeoutStack = parentPlaceholder.timeoutStack;
    this.minSlow = parentPlaceholder.minSlow || 0;

    this.snapshotsWaiting = [];

    this.globalsCheck = new GlobalEnv( this.runner.globals );

    this.finished = false;

    this.deferred = null;

    const _this: any = this;
    _this.run = this.run.bind( this );
    _this.exit = this.exit.bind( this );
    _this.exitError = this.exitError.bind( this );
  }

  clone() {
    return new Runnable( this.placeholder, this.parent );
  }

  assertCall( name: string ) {
    if ( this.finished ) {
      this.addError(
        new Error( `You should not call .${name}() after the test has finished.` ),
        getStack( 3 )
      );
      return false;
    }
    return true;
  }

  publicApi( context: ContextRef ): PublicTestApi {
    return {
      plan: this.plan.bind( this ),
      incCount: this.incCount.bind( this ),
      skip: this.skip.bind( this ),
      retries: this.retries.bind( this ),
      retryDelay: this.retryDelay.bind( this ),
      reruns: this.defineReruns.bind( this ),
      rerunDelay: this.rerunDelay.bind( this ),
      timeout: this.timeout.bind( this ),
      slow: this.defineSlow.bind( this ),
      log: this.log.bind( this ),
      matchesSnapshot: this.matchesSnapshot.bind( this ),
      get context() {
        return context.get();
      },
      set context( context ) {
        context.set( context );
      }
    };
  }

  log( ...args: unknown[] ) {
    if ( args.length > 0 ) {
      this.logs.push(
        args.map(
          value => ( typeof value === "string" ? value : this.runner.format( value ) )
        ).join( " " )
      );
    }
  }

  matchesSnapshot( something: unknown, key?: string ) {
    const deferred = defer<void>();
    this.snapshotsWaiting.push( deferred );
    this.incCount();
    this.runner.matchesSnapshot(
      something,
      getStack( 2 ),
      `${this.fullname.join( " " )}${key ? ` ${key}` : ""}`,
      deferred
    );
    return deferred.promise;
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

  skip( reason?: string ) {
    if ( this.assertCall( "skip" ) ) {
      this.status = "skipped";
      throw new SkipError( reason );
    }
  }

  retries( n: NumOrVoid ) {
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

  retryDelay( n: NumOrVoid ) {
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

  defineReruns( n: NumOrVoid ) {
    if ( this.metadata.type !== "test" ) {
      throw new Error( ".reruns() is not available for hooks" );
    }
    if ( this.assertCall( "reruns" ) ) {
      if ( n === undefined ) {
        return this.reruns;
      }
      assertNumber( n );
      this.reruns = n;
    }
  }

  rerunDelay( n: NumOrVoid ) {
    if ( this.metadata.type !== "test" ) {
      throw new Error( ".rerunDelay() is not available for hooks" );
    }
    if ( this.assertCall( "rerunDelay" ) ) {
      if ( n === undefined ) {
        return this.rerunDelayValue;
      }
      assertDelay( n );
      this.rerunDelayValue = n;
    }
  }

  timeout( n: NumOrVoid ) {
    if ( this.assertCall( "timeout" ) ) {
      if ( n === undefined ) {
        return this.maxTimeout;
      }
      assertTimeout( n );
      this.maxTimeout = n;
      this.timeoutStack = getStack( 2 );
    }
  }

  defineSlow( n: NumOrVoid ) {
    if ( this.assertCall( "slow" ) ) {
      if ( n === undefined ) {
        return this.minSlow;
      }
      assertNumber( n );
      this.minSlow = n;
    }
  }

  addError( e: any, stack?: string ) {
    const err = this.runner.processError( e, stack );
    if ( this.finished ) {
      if ( this.status !== "failed" ) {
        this.runner.otherError( err );
      }
      return;
    }
    if ( err instanceof SkipError || err.name === "SkipError" ) {
      this.skipReason = err.message;
      return;
    }
    this.errors.push( err );
    this.assertions.push( err );
  }

  checkPlanCount() {
    if ( this.errors.length ) {
      return;
    }
    if ( this.didPlan && this.planned !== this.assertionCount ) {
      this.addError(
        new Error( "Planned " + this.planned + " but " + this.assertionCount + " assertions were run." ),
        this.planStack
      );
    } else if ( !this.didPlan && this.assertionCount === 0 && !this.metadata.allowNoPlan && this.metadata.type === "test" ) {
      this.addError(
        new Error( "No assertions were run." ),
        this.placeholder.defaultStack
      );
    }
  }

  skipOrTodoExit() {
    this.finished = true;
    return this;
  }

  exitError( error: any ) {
    this.addError( error );
    return this.exit();
  }

  checkFailure() {
    if ( this.errors.length ) {
      this.status = "failed";
    } else {
      this.status = this.status || "passed";
    }

    if ( this.status === "failed" && this.metadata.type !== "test" ) {
      this.failedBecauseOfHook = { level: this.level };
    }
  }

  exit() {
    if ( this.finished ) {
      return this;
    }

    if ( this.timeStart ) {
      this.runtime = Date.now() - this.timeStart;
    }

    if ( this.timeoutId ) {
      clearTimeout( this.timeoutId );
    }

    this.slow = this.minSlow ? this.runtime >= this.minSlow : false;

    if ( !this.status ) {
      const e = this.globalsCheck.check();
      if ( e ) {
        this.addError( e );
      }

      if ( !this.errors.length ) {
        this.checkPlanCount();
      }
    }

    this.finished = true;
    this.checkFailure();

    if ( this.snapshotsWaiting.length ) {
      return Promise.all( this.snapshotsWaiting.map( d => d.promise ) ).then( errors => {
        for ( const error of errors ) {
          if ( error ) {
            this.errors.push( error );
          }
        }
        this.checkFailure();
        return this;
      } );
    }

    return this;
  }

  runSkip( reason?: string ) {
    this.status = "skipped";
    this.skipReason = reason;
    return this.skipOrTodoExit();
  }

  runTodo() {
    this.status = "todo";
    return this.skipOrTodoExit();
  }

  run( context: ContextRef ) {
    if ( this.metadata.status === "skipped" ) {
      return this.runSkip();
    }

    if ( this.metadata.status === "todo" ) {
      return this.runTodo();
    }

    let callback = this.callback;
    let error;
    let ret;

    this.timeStart = Date.now();

    if ( this.globalsCheck ) {
      this.globalsCheck.start();
    }

    try {
      ret = callback( this.publicApi( context ) );
    } catch ( e ) {
      error = e;
    }

    if ( error ) {
      return this.exitError( error );
    }

    if ( this.maxTimeout && this.runner.options.timeouts ) {
      this.timeoutId = setTimeout( () => {
        this.addError( new Error( "Timeout exceeded." ), this.timeoutStack );

        const d = this.deferred;
        if ( d ) {
          this.deferred = null;
          d.resolve();
        }
      }, this.maxTimeout );
    }

    let promise;

    if ( isObservable( ret ) ) {
      promise = observableToPromise( ret );
    } else if ( isPromise( ret ) ) {
      promise = ret;
    }

    if ( promise ) {
      const d = this.deferred = defer();
      return Promise.race( [ promise, d.promise ] ).then( this.exit, this.exitError );
    }

    return this.exit();
  }

}

export default class Test implements ITestResult, IRunnable {

  name: string;
  fullname: string[];
  status: Status | undefined;
  runtime: number;
  suiteName: string;
  errors: any[];
  assertions: any[];
  slow: boolean;
  logs: string[];
  level: number;
  failedBecauseOfHook: { level: number } | null;
  skipReason: string | undefined;
  placeholder: TestPlaceholder;
  runnable: Runnable | InTestSequence;
  metadata: TestMetadata;
  runner: Runner;
  memoryUsage: number;

  currentRetry: number;
  maxRetries: number;
  retryDelayValue: number;

  currentRerun: number;
  reruns: number;
  rerunDelayValue: number;

  testStartInfo: TestStart | null;
  testEndInfo: TestEnd | null;

  constructor( placeholder: TestPlaceholder, runnable: Runnable | InTestSequence, parent: Suite ) {

    this.name = placeholder.name;
    this.fullname = placeholder.fullname;

    this.status = undefined;

    this.runtime = 0;

    this.suiteName = parent.name;

    this.errors = [];
    this.assertions = [];

    this.slow = false;

    this.logs = [];

    this.level = placeholder.level;
    this.failedBecauseOfHook = null;
    this.skipReason = undefined;

    parent.tests.push( this );

    this.placeholder = placeholder;

    this.runnable = runnable;
    this.metadata = placeholder.metadata;
    this.runner = parent.runner;

    this.memoryUsage = 0;

    this.currentRetry = 0;
    this.maxRetries = 0; // Gets defined after the first run
    this.retryDelayValue = 0; // Gets defined after the first run

    this.currentRerun = 0;
    this.reruns = 0; // Gets defined after the first run
    this.rerunDelayValue = 0; // Gets defined after the first run

    this.testStartInfo = null;
    this.testEndInfo = null;

    const _this: any = this;
    _this.run = this.run.bind( this );
    _this.end = this.end.bind( this );
  }

  start() {
    this.runner.testStart( this );
  }

  copyFromRunnable() {
    this.errors = this.runnable.errors;
    this.assertions = this.runnable.assertions;
    this.status = this.runnable.status;
    this.runtime = this.runnable.runtime;
    this.slow = this.runnable.slow;
    this.logs = this.runnable.logs;
    this.failedBecauseOfHook = this.runnable.failedBecauseOfHook;
    this.skipReason = this.runnable.skipReason;
  }

  end( context: ContextRef, copyContext: ContextRef ): IRunReturn<Test> {
    this.copyFromRunnable();

    if ( this.runner.options.logHeapUsage ) {
      if ( global.gc ) {
        global.gc();
      }
      this.memoryUsage = process.memoryUsage().heapUsed;
    }

    if ( this.metadata.status === "failing" ) {
      if ( this.status === "failed" ) {
        this.status = "passed";
        this.errors.length = 0;
      } else if ( this.status === "passed" ) {
        this.status = "failed";
        this.errors.push(
          this.runner.processError(
            new Error( "Test was expected to fail, but succeeded, you should stop marking the test as failing." ),
            this.placeholder.defaultStack
          )
        );
      }
    }

    if ( this.currentRetry === 0 && this.currentRerun === 0 ) { // Only set these after the first run
      const runnable = this.runnable;

      if ( runnable instanceof InTestSequence ) {
        this.maxRetries = runnable.middleRunnable.maxRetries;
        this.retryDelayValue = runnable.middleRunnable.retryDelayValue;
        this.reruns = runnable.middleRunnable.reruns;
        this.rerunDelayValue = runnable.middleRunnable.rerunDelayValue;
      } else {
        this.maxRetries = runnable.maxRetries;
        this.retryDelayValue = runnable.retryDelayValue;
        this.reruns = runnable.reruns;
        this.rerunDelayValue = runnable.rerunDelayValue;
      }
    }

    if ( this.status === "passed" ) {
      if ( this.currentRerun < this.reruns ) {
        this.currentRetry = 0;
        this.currentRerun++;
        this.runnable = this.runnable.clone();
        return new Promise( resolve => {
          setTimeout( () => resolve( this.runTry( context ) ), this.rerunDelayValue );
        } );
      }
    }

    if ( this.status === "failed" && !this.failedBecauseOfHook ) {
      if ( this.currentRetry < this.maxRetries ) {
        this.currentRetry++;
        this.runnable = this.runnable.clone();
        return new Promise( resolve => {
          setTimeout( () => resolve( this.runTry( context ) ), this.retryDelayValue );
        } );
      }
    }

    if ( this.metadata.type !== "test" ) {
      // To share context between before/after hooks
      context.set( copyContext.get() );
    }

    this.runner.testEnd( this );
    return this;
  }

  runSkip( reason?: string ) {
    this.start();
    this.runnable.runSkip( reason );
    this.copyFromRunnable();
    this.runner.testEnd( this );
    return this;
  }

  runTodo() {
    this.start();
    this.runnable.runTodo();
    this.copyFromRunnable();
    this.runner.testEnd( this );
    return this;
  }

  runTry( context: ContextRef ): IRunReturn<Test> {
    const copyContext = context.copy();
    const run = this.runnable.run( copyContext );
    if ( isPromise( run ) ) {
      return run.then( () => this.end( context, copyContext ) );
    }
    return this.end( context, copyContext );
  }

  run( context: ContextRef ) {
    this.start();
    return this.runTry( context );
  }

}
