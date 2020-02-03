import Runner from "../../src/core/runner";

describe("unit", () => {
  it("hooks times", () => {
    expect.assertions(5);

    let runner = Runner.init({ allowNoPlan: true });
    let t = runner.test;

    let before = 0;
    let after = 0;
    let beforeEach = 0;
    let afterEach = 0;
    let test = 0;

    t.before(() => {
      before++;
    });

    t.after(() => {
      after++;
    });

    t.beforeEach(() => {
      beforeEach++;
    });

    t(() => {
      test++;
    });

    t.afterEach(() => {
      afterEach++;
    });

    t(() => {
      test++;
    });

    t(() => {
      test++;
    });

    return runner.run().then(() => {
      expect(before).toBe(1);
      expect(after).toBe(1);
      expect(beforeEach).toBe(3);
      expect(afterEach).toBe(3);
      expect(test).toBe(3);
    });
  });
});
