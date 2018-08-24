// @flow
import isPromise from "./util/is-promise";
import type { Status, IRunnable, GroupMetadata } from "./types";
import type Runner from "./runner";
import type Test from "./test";
import type TestCollection from "./test-collection";
import type { BeforeTestsAfterSequence } from "./sequence";
import type { GroupPlaceholder } from "./placeholders";
import { ContextRef } from "./context";

export default class Suite implements IRunnable {

  name: string;
  fullname: string[];
  status: Status;
  runtime: number;
  tests: Test[];
  childSuites: Suite[];
  testCounts: {
    passed: number,
    failed: number,
    skipped: number,
    todo: number,
    total: number
  };
  level: number;
  failedBecauseOfHook: ?{ level: number };
  skipReason: ?string;
  timeStart: number;
  finished: boolean;
  metadata: GroupMetadata;
  runner: Runner;
  placeholder: GroupPlaceholder;
  collection: TestCollection;
  sequence: BeforeTestsAfterSequence;
  suiteStartInfo: ?Object;
  suiteEndInfo: ?Object;

  constructor( placeholder: GroupPlaceholder, parent: ?Suite ) {

    this.name = placeholder.name;
    this.fullname = placeholder.fullname;

    this.status = undefined;

    this.runtime = 0;

    this.tests = [];

    this.childSuites = [];

    this.testCounts = {
      passed: 0,
      failed: 0,
      skipped: 0,
      todo: 0,
      total: 0
    };

    this.level = placeholder.level;
    this.failedBecauseOfHook = null;
    this.skipReason = undefined;

    this.timeStart = 0;

    this.finished = false;

    this.metadata = placeholder.metadata;
    this.runner = placeholder.runner;
    this.placeholder = placeholder;

    if ( parent ) {
      // Save this suite in the parent
      parent.childSuites.push( this );
    }

    this.collection = placeholder.collection;
    this.sequence = this.collection.build( this );

    this.suiteStartInfo = null;
    this.suiteEndInfo = null;

    const _this: any = this;
    _this.run = this.run.bind( this );
    _this.exit = this.exit.bind( this );
  }

  hasTests() {
    return this.collection.tests.concurrent.length || this.collection.tests.serial.length;
  }

  exit() {
    if ( this.finished ) {
      return this;
    }
    this.finished = true;

    this.failedBecauseOfHook = this.sequence.failedBecauseOfHook;
    this.skipReason = this.sequence.skipReason;

    if ( this.timeStart ) {
      this.runtime = Date.now() - this.timeStart;
    }

    const testCounts = this.testCounts;

    this.tests.forEach( t => {
      switch ( t.status ) {
        case "passed":
          testCounts.passed++;
          break;
        case "failed":
          testCounts.failed++;
          break;
        case "skipped":
          testCounts.skipped++;
          break;
        case "todo":
          testCounts.todo++;
          break;
        default:
          throw new Error( `Test '${t.fullname.join( " " )}' [${t.metadata.type}] did not finish` );
      }
    } );

    this.childSuites.forEach( t => {
      testCounts.passed += t.testCounts.passed;
      testCounts.skipped += t.testCounts.skipped;
      testCounts.failed += t.testCounts.failed;
      testCounts.todo += t.testCounts.todo;
    } );

    const sum = testCounts.passed + testCounts.failed + testCounts.skipped + testCounts.todo;

    if ( testCounts.total !== sum ) {
      throw new Error( `Wrong count. Total: ${testCounts.total}, Sum: ${sum}` );
    }

    if ( testCounts.total === testCounts.skipped ) {
      this.status = "skipped";
    } else if ( testCounts.total === testCounts.todo ) {
      this.status = "todo";
    } else if ( testCounts.failed ) {
      this.status = "failed";
    } else {
      this.status = "passed";
    }

    this.runner.suiteEnd( this );
    return this;
  }

  getTestsCount() {
    let total = this.tests.length;
    this.childSuites.forEach( t => {
      total += t.getTestsCount();
    } );
    return total;
  }

  start() {
    this.testCounts.total = this.getTestsCount();
    this.runner.suiteStart( this );
  }

  runSkip( reason: ?string ) {
    this.start();
    this.sequence.runSkip( reason );
    return this.exit();
  }

  runTodo() {
    this.start();
    this.sequence.runTodo();
    return this.exit();
  }

  run() {
    if ( this.metadata.status === "skipped" ) {
      return this.runSkip();
    }

    if ( this.metadata.status === "todo" ) {
      return this.runTodo();
    }

    this.start();

    this.timeStart = Date.now();

    const result = this.sequence.run( new ContextRef() );

    if ( isPromise( result ) ) {
      return result.then( this.exit, this.exit );
    }

    return this.exit();
  }

}
