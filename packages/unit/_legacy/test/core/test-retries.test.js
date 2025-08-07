import Runner from "../../src/core/runner";

describe("unit", () => {
  it("test retries", () => {
    expect.assertions(4);

    const runner = Runner.init({ allowNoPlan: true });
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = ["test", "test"];

    test("test", t => {
      t.retries(1);
      actual.push("test");
      throw new Error("error");
    });

    return runner.run().then(() => {
      expect(actual).toEqual(expected);
      expect(results[5].errors[0].message).toBe("error");
      expect(results[5].errors).toHaveLength(1);
      expect(results.pop().status).toBe("failed");
    });
  });

  it("test retries with delay", () => {
    expect.assertions(5);

    const runner = Runner.init({ allowNoPlan: true });
    const results = runner.listen();
    const test = runner.test;

    const times = [];

    test("test", t => {
      t.retries(1);
      t.retryDelay(100);
      times.push(Date.now());
      throw new Error("error");
    });

    return runner.run().then(() => {
      expect(times).toHaveLength(2);
      expect(times[1] - times[0] >= 100).toBe(true);
      expect(results[5].errors[0].message).toBe("error");
      expect(results[5].errors).toHaveLength(1);
      expect(results.pop().status).toBe("failed");
    });
  });

  it("test retries inherit value from group", () => {
    expect.assertions(2);

    const runner = Runner.init({ allowNoPlan: true });
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = ["test", "test"];

    test.group(t => {
      t.retries(1);

      test("test", () => {
        actual.push("test");
        throw new Error("error");
      });
    });

    return runner.run().then(() => {
      expect(actual).toEqual(expected);
      expect(results.pop().status).toBe("failed");
    });
  });

  it("hooks are also run when retrying", () => {
    expect.assertions(2);

    const runner = Runner.init({ allowNoPlan: true });
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "beforeEach",
      "test",
      "afterEach",
      "beforeEach",
      "test",
      "afterEach",
    ];

    test.beforeEach(() => {
      actual.push("beforeEach");
    });

    test.group(t => {
      t.retries(1);

      test("test", () => {
        actual.push("test");
        throw new Error("error");
      });
    });

    test.afterEach(() => {
      actual.push("afterEach");
    });

    return runner.run().then(() => {
      expect(actual).toEqual(expected);
      expect(results.pop().status).toBe("failed");
    });
  });

  it("dont retry if beforeEach failed", () => {
    expect.assertions(2);

    const runner = Runner.init({ allowNoPlan: true });
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = ["beforeEach", "afterEach"];

    test.beforeEach(() => {
      actual.push("beforeEach");
      throw new Error("error");
    });

    test.group(t => {
      t.retries(1);

      test(() => {
        /* istanbul ignore next */
        actual.push("dont run");
      });
    });

    test.afterEach(() => {
      actual.push("afterEach");
    });

    return runner.run().then(() => {
      expect(actual).toEqual(expected);
      expect(results.pop().status).toBe("failed");
    });
  });

  it("dont retry if afterEach failed", () => {
    expect.assertions(2);

    const runner = Runner.init({ allowNoPlan: true });
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = ["beforeEach", "test", "afterEach"];

    test.beforeEach(() => {
      actual.push("beforeEach");
    });

    test.group(t => {
      t.retries(1);

      test("test", () => {
        actual.push("test");
      });
    });

    test.afterEach(() => {
      actual.push("afterEach");
      throw new Error("error");
    });

    return runner.run().then(() => {
      expect(actual).toEqual(expected);
      expect(results.pop().status).toBe("failed");
    });
  });

  it("calling .retries() again makes no difference", () => {
    expect.assertions(4);

    const runner = Runner.init({ allowNoPlan: true });
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = ["test", "test retry"];

    let count = 0;

    test("test", t => {
      t.retries(1);
      if (count++ === 0) {
        actual.push("test");
      } else {
        t.retries(10);
        actual.push("test retry");
      }
      throw new Error("error");
    });

    return runner.run().then(() => {
      expect(actual).toEqual(expected);
      expect(results[5].errors[0].message).toBe("error");
      expect(results[5].errors).toHaveLength(1);
      expect(results.pop().status).toBe("failed");
    });
  });

  it("mark as skipped if called t.skip() in second run", () => {
    expect.assertions(2);

    const runner = Runner.init({ allowNoPlan: true });
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "beforeEach",
      "test",
      "afterEach",
      "beforeEach",
      "test",
      "afterEach",
    ];

    let count = 0;

    test.beforeEach(() => {
      actual.push("beforeEach");
    });

    test.group(t => {
      t.retries(1);

      test("test", t => {
        actual.push("test");
        if (count++ === 0) {
          throw new Error("error");
        } else {
          t.skip();
        }
      });
    });

    test.afterEach(() => {
      actual.push("afterEach");
    });

    return runner.run().then(() => {
      expect(actual).toEqual(expected);
      expect(results.pop().status).toBe("skipped");
    });
  });

  it("mark as skipped if called t.skip() (inside beforeEach) in second run", () => {
    expect.assertions(2);

    const runner = Runner.init({ allowNoPlan: true });
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [
      "beforeEach",
      "test",
      "afterEach",
      "beforeEach",
      "afterEach",
    ];

    let count = 0;

    test.beforeEach(t => {
      actual.push("beforeEach");
      if (count !== 0) {
        t.skip();
      }
    });

    test.group(t => {
      t.retries(1);

      test("test", () => {
        actual.push("test");
        if (count++ === 0) {
          throw new Error("error");
        }
      });
    });

    test.afterEach(() => {
      actual.push("afterEach");
    });

    return runner.run().then(() => {
      expect(actual).toEqual(expected);
      expect(results.pop().status).toBe("skipped");
    });
  });

  it(".retries() not available for hooks", () => {
    expect.assertions(2);

    const runner = Runner.init({ allowNoPlan: true });
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [];

    test.beforeEach(t => {
      t.retries(10);
    });

    test(() => {
      /* istanbul ignore next */
      actual.push("dont run");
    });

    return runner.run().then(() => {
      expect(actual).toEqual(expected);
      expect(results[5].errors[0].message).toBe(
        ".retries() is not available for hooks"
      );
    });
  });

  it(".retryDelay() not available for hooks", () => {
    expect.assertions(2);

    const runner = Runner.init({ allowNoPlan: true });
    const results = runner.listen();
    const test = runner.test;

    const actual = [];
    const expected = [];

    test.beforeEach(t => {
      t.retryDelay(10);
    });

    test(() => {
      /* istanbul ignore next */
      actual.push("dont run");
    });

    return runner.run().then(() => {
      expect(actual).toEqual(expected);
      expect(results[5].errors[0].message).toBe(
        ".retryDelay() is not available for hooks"
      );
    });
  });

  it("throw when retryDelay value is not number - group", () => {
    const runner = Runner.init({ allowNoPlan: true });
    const test = runner.test;

    expect(() => {
      test.group(t => {
        t.retryDelay("abc");
      });
    }).toThrow(/Expected a number but saw/);
  });

  it("throw when retryDelay value is too big - group", () => {
    const runner = Runner.init({ allowNoPlan: true });
    const test = runner.test;

    expect(() => {
      test.group(t => {
        t.retryDelay(2 ** 31 + 1);
      });
    }).toThrow(/2147483649 is too big of a delay value/);
  });
});
