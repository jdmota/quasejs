import Runner from "../../src/core/runner";

describe("unit", () => {
  it("test slow", () => {
    expect.assertions(2);

    let runner = Runner.init({
      slow: 5000,
      allowNoPlan: true,
    });
    let results = runner.listen();
    let test = runner.test;

    test("test", t => {
      t.slow(1);
      return new Promise(resolve => {
        setTimeout(resolve, 100);
      });
    });

    return runner.run().then(() => {
      expect(results[5].status).toBe("passed");
      expect(results[5].slow).toBe(true);
    });
  });

  it("test slow inside group", () => {
    expect.assertions(2);

    let runner = Runner.init({ allowNoPlan: true });
    let results = runner.listen();
    let test = runner.test;

    test.group(t => {
      t.slow(1);

      test("test", () => {
        return new Promise(resolve => {
          setTimeout(resolve, 100);
        });
      });
    });

    return runner.run().then(() => {
      expect(results[7].status).toBe("passed");
      expect(results[7].slow).toBe(true);
    });
  });

  it("test slow inside group (override)", () => {
    expect.assertions(3);

    let runner = Runner.init({
      slow: 1,
      allowNoPlan: true,
    });
    let results = runner.listen();
    let test = runner.test;

    test.group(t => {
      t.slow(3000);

      expect(t.slow()).toBe(3000);

      test("test", () => {
        return new Promise(resolve => {
          setTimeout(resolve, 10);
        });
      });
    });

    return runner.run().then(() => {
      expect(results[7].status).toBe("passed");
      expect(results[7].slow).toBe(false);
    });
  });

  it("test slow of zero disables", () => {
    expect.assertions(3);

    let runner = Runner.init({ allowNoPlan: true });
    let results = runner.listen();
    let test = runner.test;

    test.group(t => {
      t.slow(1);

      test("test", t => {
        t.slow(0);
        expect(t.slow()).toBe(0);
        return new Promise(resolve => {
          setTimeout(resolve, 100);
        });
      });
    });

    return runner.run().then(() => {
      expect(results[7].status).toBe("passed");
      expect(results[7].slow).toBe(false);
    });
  });

  it("test slow of zero disables 2", () => {
    expect.assertions(2);

    let runner = Runner.init({
      slow: 2,
      allowNoPlan: true,
    });
    let results = runner.listen();
    let test = runner.test;

    test.group(t => {
      t.slow(0);

      test("test", () => {
        return new Promise(resolve => {
          setTimeout(resolve, 100);
        });
      });
    });

    return runner.run().then(() => {
      expect(results[7].status).toBe("passed");
      expect(results[7].slow).toBe(false);
    });
  });

  it("t.slow() returns current value from parent suite", () => {
    expect.assertions(4);

    let runner = Runner.init({ allowNoPlan: true });
    let results = runner.listen();
    let test = runner.test;

    const g = test.group();

    expect(g.slow()).toBe(0);

    g.slow(1000);

    expect(g.slow()).toBe(1000);

    g.test(t => {
      expect(t.slow()).toBe(1000);
    });

    return runner.run().then(() => {
      expect(results[11].status).toBe("passed");
    });
  });

  it("t.slow() returns current value from runner", () => {
    expect.assertions(2);

    let runner = Runner.init({
      slow: 5000,
      allowNoPlan: true,
    });
    let results = runner.listen();
    let test = runner.test;

    test("test", t => {
      expect(t.slow()).toBe(5000);
    });

    return runner.run().then(() => {
      expect(results[5].status).toBe("passed");
    });
  });
});
