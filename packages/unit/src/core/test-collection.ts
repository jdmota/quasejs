import matcher from "matcher";
import Runner from "./runner";
import Suite from "./suite";
import { Sequence, InTestSequence, BeforeTestsAfterSequence } from "./sequence";
import { Placeholder, TestPlaceholder, GroupPlaceholder } from "./placeholders";

// They are returned in reverse order
function getBeforeEach(suite: Suite) {
  const hooks = [];
  let p = suite.placeholder;

  while (p && p.collection) {
    const beforeEach = p.collection.hooks.beforeEach;
    for (let i = beforeEach.length - 1; i >= 0; i--) {
      hooks.push(beforeEach[i]);
    }
    p = p.parent;
  }

  return hooks;
}

// They are returned in correct order
function getAfterEach(suite: Suite) {
  const hooks = [];
  let p = suite.placeholder;

  while (p && p.collection) {
    const afterEach = p.collection.hooks.afterEach;
    for (let i = 0; i < afterEach.length; i++) {
      hooks.push(afterEach[i]);
    }
    p = p.parent;
  }

  return hooks;
}

export default class TestCollection {
  hasExclusive: boolean;
  runner: Runner;
  tests: {
    concurrent: Placeholder[];
    serial: Placeholder[];
  };
  hooks: {
    before: TestPlaceholder[];
    beforeEach: TestPlaceholder[];
    after: TestPlaceholder[];
    afterEach: TestPlaceholder[];
  };
  _hasUnskippedTests: boolean | undefined;

  constructor(runner: Runner) {
    this.hasExclusive = false;
    this.runner = runner;
    this.tests = {
      concurrent: [],
      serial: [],
    };
    this.hooks = {
      before: [],
      beforeEach: [],
      after: [],
      afterEach: [],
    };
    this._hasUnskippedTests = undefined;
  }

  addTest(test: Placeholder, suite: GroupPlaceholder) {
    const metadata = test.metadata;
    const type = metadata.type;

    if (type !== "test" && type !== "group") {
      if (test instanceof TestPlaceholder) {
        this.hooks[type].push(test);
      } else {
        throw new Error(`Assertion error`);
      }
      return;
    }

    const match = suite.runner.match;
    let willRun = true;

    if (metadata.exclusive) {
      suite.runner.onlyCount++;
    }

    if (type === "test") {
      if (!metadata.exclusive && suite.runner.options.only) {
        return;
      }
      if (match.length > 0) {
        willRun =
          metadata.exclusive || matcher(test.fullname, match).length > 0;
      }
    }

    // If .only() was used previously, only add .only() tests
    if (this.hasExclusive && !metadata.exclusive) {
      return;
    }

    if (metadata.exclusive && !this.hasExclusive) {
      this.tests.concurrent = [];
      this.tests.serial = [];
      this.hasExclusive = true;
    }

    if (willRun) {
      if (metadata.serial || suite.forceSerial) {
        this.tests.serial.push(test);
      } else {
        this.tests.concurrent.push(test);
      }
    }
  }

  buildTest(test: Placeholder, suite: Suite) {
    if (test instanceof GroupPlaceholder) {
      return test.build(suite);
    }

    if (test.metadata.status === "skipped" || test.metadata.status === "todo") {
      return test.build(test.buildRunnable(suite), suite);
    }

    const seq = new InTestSequence(
      this.runner,
      suite.level,
      test.metadata,
      test.buildRunnable(suite)
    );

    const beforeEachHooks = getBeforeEach(suite);
    for (let i = beforeEachHooks.length - 1; i >= 0; i--) {
      seq.add(beforeEachHooks[i].buildRunnable(suite));
    }

    seq.pushMiddle();

    const afterEachHooks = getAfterEach(suite);
    for (let i = 0; i < afterEachHooks.length; i++) {
      seq.add(afterEachHooks[i].buildRunnable(suite));
    }

    return test.build(seq, suite);
  }

  buildTestSeq(array: Placeholder[], isConcurrent: boolean, suite: Suite) {
    if (array.length === 1) {
      return this.buildTest(array[0], suite);
    }

    let seq = new Sequence(this.runner, isConcurrent, suite.level);

    for (let i = 0; i < array.length; i++) {
      seq.add(this.buildTest(array[i], suite));
    }

    return seq;
  }

  hasUnskippedTests() {
    if (this._hasUnskippedTests == null) {
      this._hasUnskippedTests = this.tests.serial
        .concat(this.tests.concurrent)
        .some(test => {
          const skipped =
            test.metadata.status === "skipped" ||
            test.metadata.status === "todo";
          if (!skipped && test instanceof GroupPlaceholder) {
            return test.collection.hasUnskippedTests();
          }
          return !skipped;
        });
    }
    return this._hasUnskippedTests;
  }

  // Use sequences to:
  // 1. Run the beforeEach hooks, the test and the afterEach hooks
  // 2. Run the before hooks, a collection of tests and the after hooks

  // Returns a sequence
  build(suite: Suite): BeforeTestsAfterSequence {
    const serial = this.tests.serial;
    const concurrent = this.tests.concurrent;
    const before = this.hooks.before;
    const after = this.hooks.after;
    const seq = new BeforeTestsAfterSequence(this.runner, suite.level);

    const runBeforeAfter = this.hasUnskippedTests();

    if (runBeforeAfter) {
      for (let i = 0; i < before.length; i++) {
        seq.add(before[i].build(before[i].buildRunnable(suite), suite));
      }
    }

    const randomizer =
      suite.placeholder.randomizationAllowed && suite.runner.randomizer;

    if (serial.length) {
      const tests = randomizer ? randomizer.shuffle(serial) : serial;
      seq.add(this.buildTestSeq(tests, false, suite), true);
    }

    if (concurrent.length) {
      const tests = randomizer ? randomizer.shuffle(concurrent) : concurrent;
      seq.add(this.buildTestSeq(tests, true, suite), true);
    }

    if (runBeforeAfter) {
      for (let i = 0; i < after.length; i++) {
        seq.add(after[i].build(after[i].buildRunnable(suite), suite));
      }
    }

    return seq;
  }
}
