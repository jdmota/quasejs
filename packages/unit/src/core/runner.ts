import { EventEmitter } from "events";
import { GroupPlaceholder, TestPlaceholder } from "./placeholders";
import { createTestChain } from "./chain";
import validateOptions, { cliValidate } from "./validate-options";
import {
  SuiteStart,
  SuiteEnd,
  TestStart,
  TestEnd,
  Deferred,
  NormalizedOptions,
  RunEnd,
  RunStart,
} from "../types";
import Suite from "./suite";
import Test from "./test";
import randomizerFn from "./random";

const concordance = require("concordance");

class Runner extends EventEmitter {
  options: NormalizedOptions;
  globals: (string | boolean)[];
  updateSnapshots: boolean;
  concordanceOptions: any;
  randomizer: ReturnType<typeof randomizerFn>;
  match: string[];
  failedOnce: boolean;
  sentSigint: boolean;
  onlyCount: number;
  promises: PromiseLike<unknown>[];
  root: GroupPlaceholder;
  test: any;
  suite: Suite | null;
  _current: TestPlaceholder | GroupPlaceholder;

  constructor(_opts: any, inFork?: boolean) {
    super();

    this.options = validateOptions(inFork ? _opts : cliValidate(_opts));
    this.globals = this.options.globals;
    this.updateSnapshots = this.options.updateSnapshots;
    this.concordanceOptions = this.options.concordanceOptions;
    this.randomizer = randomizerFn(this.options.random);
    this.match = this.options.match;

    this.failedOnce = false;
    this.sentSigint = false;
    this.onlyCount = 0;
    this.promises = [];

    this.root = new GroupPlaceholder(
      "",
      () => {},
      {
        type: "group",
        strict: this.options.strict,
        allowNoPlan: this.options.allowNoPlan,
        serial: false,
        exclusive: false,
        status: "",
      },
      ({
        runner: this,
        level: 0,
        maxTimeout: this.options.timeout,
        timeoutStack: undefined,
        minSlow: this.options.slow,
        randomizationAllowed: true,
        serialForced: this.options.forceSerial,
      } as any) as GroupPlaceholder,
      true
    );

    this.test = createTestChain(this);

    this._current = this.root;
    this.suite = null;

    this.run = this.run.bind(this);
  }

  static init(options: any, inFork?: boolean) {
    return new Runner(options, inFork);
  }

  format(value: unknown) {
    return concordance.format(value, this.concordanceOptions);
  }

  processStack(err: Error, stack?: string) {
    if (stack && err.message) {
      return stack.replace(/^Error.*\n/, `Error: ${err.message}\n`);
    }
    return stack || err.stack;
  }

  processError(e: Error | string, stack?: string) {
    const err = (e instanceof Error ? e : new Error(e)) as any;
    err.stack = this.processStack(err, stack);
    if (err.actual !== undefined || err.expected !== undefined) {
      err.diff = concordance.diff(
        err.actual,
        err.expected,
        this.concordanceOptions
      );
    } else if (
      err.actualDescribe !== undefined &&
      err.expectedDescribe !== undefined
    ) {
      err.diff = concordance.diffDescriptors(
        err.actualDescribe,
        err.expectedDescribe,
        this.concordanceOptions
      );
    }
    return err;
  }

  otherError(err: Error | string) {
    this.emit("otherError", err instanceof Error ? err : new Error(err));
  }

  delaySetup(promise: PromiseLike<unknown>) {
    this.promises.push(promise);
  }

  listen() {
    const array: any[] = [];
    this.on("runStart", t => {
      delete t.type;
      array.push("runStart", t);
    });
    this.on("testStart", t => {
      delete t.type;
      delete t.defaultStack;
      array.push("testStart", t);
    });
    this.on("testEnd", t => {
      delete t.type;
      delete t.defaultStack;
      array.push("testEnd", t);
    });
    this.on("suiteStart", t => {
      delete t.type;
      delete t.defaultStack;
      array.push("suiteStart", t);
    });
    this.on("suiteEnd", t => {
      delete t.type;
      delete t.defaultStack;
      array.push("suiteEnd", t);
    });
    this.on("runEnd", t => {
      delete t.type;
      array.push("runEnd", t);
    });
    return array;
  }

  async run() {
    try {
      await Promise.all(this.promises);
      this.suite = this.root.build();
      this.runStart();
      await Promise.resolve(this.suite.run());
      this.runEnd();
    } catch (err) {
      this.otherError(err);
      throw err;
    }
  }

  shouldBail() {
    return this.failedOnce && this.options.bail;
  }

  shouldInterrupt() {
    return this.sentSigint;
  }

  runStart() {
    if (!this.suite) {
      throw new Error("Assertion error");
    }
    const evt: RunStart = {
      type: "runStart",
      name: this.suite.name,
      fullname: this.suite.fullname,
      tests: this.suite.tests.map(t => this._normalizeTestStart(t)),
      childSuites: this.suite.childSuites.map(t =>
        this._normalizeSuiteStart(t)
      ),
      testCounts: {
        passed: undefined,
        failed: undefined,
        skipped: undefined,
        todo: undefined,
        total: this.suite.testCounts.total,
      },
    };
    this.emit("runStart", evt);
  }

  runEnd() {
    if (!this.suite) {
      throw new Error("Assertion error");
    }
    if (!this.suite.status) {
      throw new Error("Assertion error");
    }
    const evt: RunEnd = {
      type: "runEnd",
      name: this.suite.name,
      fullname: this.suite.fullname,
      tests: this.suite.tests.map(t => this._normalizeTestEnd(t)),
      childSuites: this.suite.childSuites.map(t => this._normalizeSuiteEnd(t)),
      status: this.suite.status,
      runtime: this.suite.runtime,
      testCounts: Object.assign({}, this.suite.testCounts),
      onlyCount: this.onlyCount,
      snapshotStats: {
        added: 0,
        updated: 0,
        removed: 0,
        obsolete: 0,
      },
      whyIsRunning: [],
      pendingTests: new Set(),
      notStartedForks: [],
      interrupted: false,
    };
    this.emit("runEnd", evt);
  }

  _normalizeSuiteStart(suite: Suite): SuiteStart {
    suite.suiteStartInfo = suite.suiteStartInfo || {
      type: "suiteStart",
      name: suite.name,
      fullname: suite.fullname,
      tests: suite.tests.map(t => this._normalizeTestStart(t)),
      childSuites: suite.childSuites.map(t => this._normalizeSuiteStart(t)),
      defaultStack: suite.placeholder.defaultStack,
      testCounts: {
        passed: undefined,
        failed: undefined,
        skipped: undefined,
        todo: undefined,
        total: suite.testCounts.total,
      },
    };
    return suite.suiteStartInfo;
  }

  _normalizeSuiteEnd(suite: Suite): SuiteEnd {
    if (!suite.status) {
      throw new Error("Assertion error");
    }
    suite.suiteEndInfo = suite.suiteEndInfo || {
      type: "suiteEnd",
      name: suite.name,
      fullname: suite.fullname,
      tests: suite.tests.map(t => this._normalizeTestEnd(t)),
      childSuites: suite.childSuites.map(t => this._normalizeSuiteEnd(t)),
      status: suite.status,
      runtime: suite.runtime,
      defaultStack: suite.placeholder.defaultStack,
      testCounts: Object.assign({}, suite.testCounts),
    };
    return suite.suiteEndInfo;
  }

  suiteStart(suite: Suite) {
    if (suite.name) {
      this.emit("suiteStart", this._normalizeSuiteStart(suite));
    }
  }

  suiteEnd(suite: Suite) {
    if (suite.name) {
      this.emit("suiteEnd", this._normalizeSuiteEnd(suite));
    }
  }

  _normalizeTestStart(test: Test): TestStart {
    test.testStartInfo = test.testStartInfo || {
      type: "testStart",
      name: test.name,
      suiteName: test.suiteName,
      fullname: test.fullname,
      defaultStack: test.placeholder.defaultStack,
    };
    return test.testStartInfo;
  }

  _normalizeTestEnd(test: Test): TestEnd {
    if (!test.status) {
      throw new Error("Assertion error");
    }
    test.testEndInfo = test.testEndInfo || {
      type: "testEnd",
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
      memoryUsage: test.memoryUsage,
    };
    return test.testEndInfo;
  }

  testStart(test: Test) {
    this.emit("testStart", this._normalizeTestStart(test));
  }

  testEnd(test: Test) {
    this.emit("testEnd", this._normalizeTestEnd(test));

    if (test.status === "failed") {
      this.failedOnce = true;
    }
  }

  matchesSnapshot(
    something: unknown,
    stack: string,
    key: string,
    deferred: Deferred<void>
  ) {
    this.emit("matchesSnapshot", {
      something,
      stack,
      key,
      deferred,
    });
  }
}

export default Runner;
