import Runner from "../../src/core/runner";

describe("unit", () => {
  it("match", () => {
    expect.assertions(2);

    const runner = Runner.init({ match: "match*" });
    const results = runner.listen();
    const t = runner.test;

    const actual = [];
    const expected = [
      "group",
      "before",
      "beforeEach",
      "group beforeEach",
      "group beforeEach 2",
      "group test",
      "group afterEach",
      "group afterEach 2",
      "afterEach",
      "afterEach 2",
      "after",
    ];

    t.before(() => {
      actual.push("before");
    });

    t.after(() => {
      actual.push("after");
    });

    t.beforeEach(() => {
      actual.push("beforeEach");
    });

    t(() => {
      /* istanbul ignore next */
      actual.push("dont run");
    });

    t(() => {
      /* istanbul ignore next */
      actual.push("dont run");
    });

    t.group(() => {
      actual.push("group");

      t.beforeEach(() => {
        actual.push("group beforeEach");
      });

      t.afterEach(() => {
        actual.push("group afterEach");
      });

      t.beforeEach(() => {
        actual.push("group beforeEach 2");
      });

      t.afterEach(() => {
        actual.push("group afterEach 2");
      });

      t("match test", t => {
        t.incCount();
        actual.push("group test");
      });

      t(() => {
        /* istanbul ignore next */
        actual.push("dont run");
      });

      t(() => {
        /* istanbul ignore next */
        actual.push("dont run");
      });
    });

    t.afterEach(() => {
      actual.push("afterEach");
    });

    t.afterEach(() => {
      actual.push("afterEach 2");
    });

    return runner.run().then(() => {
      expect(actual).toEqual(expected);
      expect(results[results.length - 1].testCounts).toEqual({
        failed: 0,
        passed: 3,
        skipped: 0,
        todo: 0,
        total: 3,
      });
    });
  });
});
