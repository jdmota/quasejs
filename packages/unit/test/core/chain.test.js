import Runner from "../../src/core/runner";

describe("unit", () => {
  it("chain", () => {
    expect.assertions(1);

    const runner = Runner.init({ allowNoPlan: true });
    const test = runner.test;

    const expected = ["before", "test", "after"];
    const actual = [];

    const t2 = test.before;
    const t3 = test.after;

    t3("after", () => {
      actual.push("after");
    });

    test("test", () => {
      actual.push("test");
    });

    t2("before", () => {
      actual.push("before");
    });

    return runner.run().then(() => {
      expect(actual).toEqual(expected);
    });
  });
});
