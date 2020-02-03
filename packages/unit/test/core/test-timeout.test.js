import Runner from "../../src/core/runner";

describe("unit", () => {
  it("test timeout", () => {
    expect.assertions(6);

    let runner = Runner.init({
      timeout: 3000,
      allowNoPlan: true,
    });
    let results = runner.listen();
    let test = runner.test;
    let counts = 0;

    test("test", t => {
      t.timeout(1);
      expect(t.timeout()).toBe(1);
      return new Promise(resolve => {
        setTimeout(resolve, 100);
      }).then(() => counts++);
    });

    return runner.run().then(() => {
      expect(counts).toBe(0, "If the timeout exceeds, end the test.");
      expect(results[5].status).toBe("failed");
      expect(results[5].errors[0].message).toBe("Timeout exceeded.");
      expect(results[5].errors[0].stack).toBeTruthy();
      expect(results.pop().status).toBe("failed");
    });
  });

  it("test timeout inside group", () => {
    expect.assertions(5);

    let runner = Runner.init({ allowNoPlan: true });
    let results = runner.listen();
    let test = runner.test;
    let counts = 0;

    test.group(t => {
      t.timeout(1);

      test("test", t => {
        expect(t.timeout()).toBe(1);
        return new Promise(resolve => {
          setTimeout(resolve, 100);
        }).then(() => counts++);
      });
    });

    return runner.run().then(() => {
      expect(counts).toBe(0, "If the timeout exceeds, end the test.");
      expect(results[7].status).toBe("failed");
      expect(results[7].errors[0].message).toBe("Timeout exceeded.");
      expect(results.pop().status).toBe("failed");
    });
  });

  it("test timeout inside group (override)", () => {
    expect.assertions(3);

    let runner = Runner.init({
      timeout: 1,
      allowNoPlan: true,
    });
    let results = runner.listen();
    let test = runner.test;
    let counts = 0;

    test.group(t => {
      t.timeout(3000);

      test("test", () => {
        return new Promise(resolve => {
          setTimeout(resolve, 10);
        }).then(() => counts++);
      });
    });

    return runner.run().then(() => {
      expect(counts).toBe(1);
      expect(results[7].status).toBe("passed");
      expect(results.pop().status).toBe("passed");
    });
  });

  it("test timeout of zero disables", () => {
    expect.assertions(6);

    let runner = Runner.init({ allowNoPlan: true });
    let results = runner.listen();
    let test = runner.test;
    let counts = 0;

    test.group(t => {
      expect(t.timeout()).toBe(0);

      t.timeout(2);

      expect(t.timeout()).toBe(2);

      test("test", t => {
        t.timeout(0);
        expect(t.timeout()).toBe(0);
        return new Promise(resolve => {
          setTimeout(resolve, 100);
        }).then(() => counts++);
      });
    });

    return runner.run().then(() => {
      expect(counts).toBe(1);
      expect(results[7].status).toBe("passed");
      expect(results.pop().status).toBe("passed");
    });
  });

  it("test timeout of zero disables 2", () => {
    expect.assertions(3);

    let runner = Runner.init({
      timeout: 2,
      allowNoPlan: true,
    });
    let results = runner.listen();
    let test = runner.test;
    let counts = 0;

    test.group(t => {
      t.timeout(0);

      test("test", () => {
        return new Promise(resolve => {
          setTimeout(resolve, 100);
        }).then(() => counts++);
      });
    });

    return runner.run().then(() => {
      expect(counts).toBe(1);
      expect(results[7].status).toBe("passed");
      expect(results.pop().status).toBe("passed");
    });
  });

  it("timeouts: false", () => {
    expect.assertions(3);

    const runner = Runner.init({
      timeouts: false,
      allowNoPlan: true,
    });
    const results = runner.listen();
    const test = runner.test;
    let counts = 0;

    test.group(t => {
      t.timeout(1);

      test("test", () => {
        return new Promise(resolve => {
          setTimeout(resolve, 100);
        }).then(() => counts++);
      });
    });

    return runner.run().then(() => {
      expect(counts).toBe(1);
      expect(results[7].status).toBe("passed");
      expect(results.pop().status).toBe("passed");
    });
  });

  it("timeouts: false with debug: true", () => {
    expect.assertions(3);

    const runner = Runner.init({
      debug: true,
      allowNoPlan: true,
    });
    const results = runner.listen();
    const test = runner.test;
    let counts = 0;

    test.group(t => {
      t.timeout(1);

      test("test", () => {
        return new Promise(resolve => {
          setTimeout(resolve, 100);
        }).then(() => counts++);
      });
    });

    return runner.run().then(() => {
      expect(counts).toBe(1);
      expect(results[7].status).toBe("passed");
      expect(results.pop().status).toBe("passed");
    });
  });

  it("throw when timeout value is not number - group", () => {
    let runner = Runner.init({ allowNoPlan: true });
    let test = runner.test;

    expect(() => {
      test.group(t => {
        t.timeout("abc");
      });
    }).toThrow(/Expected a number but saw/);
  });

  it("throw when timeout value is too big - group", () => {
    let runner = Runner.init({ allowNoPlan: true });
    let test = runner.test;

    expect(() => {
      test.group(t => {
        t.timeout(2 ** 31 + 1);
      });
    }).toThrow(/2147483649 is too big of a timeout value/);
  });
});
