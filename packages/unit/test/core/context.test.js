import Runner from "../../src/core/runner";

describe("unit", () => {
  it("context", () => {
    expect.assertions(9);

    let runner = Runner.init({ allowNoPlan: true });
    let results = runner.listen();
    let t = runner.test;

    t.before(({ context }) => {
      expect(context.a).toBe(undefined);
      context.a = 1;
    });

    t.beforeEach(({ context }) => {
      expect(context.a).toBe(1);
      context.a++;
    });

    t(({ context, reruns }) => {
      reruns(1);
      expect(context.a).toBe(2);
      context.a++;
    });

    t.afterEach(({ context }) => {
      expect(context.a).toBe(3);
      context.a++;
    });

    t.after(({ context }) => {
      expect(context.a).toBe(1);
    });

    return runner.run().then(() => {
      expect(results.pop().status).toBe("passed");
    });
  });

  it("context in nested groups", () => {
    expect.assertions(21);

    let runner = Runner.init({ allowNoPlan: true });
    let results = runner.listen();
    let t = runner.test;

    t.before(({ context }) => {
      expect(context.a).toBe(undefined);
      context.a = 1;
    });

    t.beforeEach(({ context }) => {
      expect(context.a).toBe(1);
      context.a++;
    });

    t(({ context, reruns }) => {
      reruns(1);
      expect(context.a).toBe(2);
      context.a++;
    });

    t.afterEach(({ context }) => {
      expect(context.a).toBe(context.secondTest ? 5 : 3);
      context.a++;
    });

    t.after(({ context }) => {
      expect(context.a).toBe(1);
    });

    t.group(() => {
      t.before(({ context }) => {
        expect(context.a).toBe(undefined);
        context.a = 1;
      });

      t.beforeEach(({ context }) => {
        expect(context.a).toBe(2);
        context.a++;
      });

      t(({ context, reruns }) => {
        reruns(1);
        expect(context.a).toBe(3);
        context.a++;
        context.secondTest = true;
      });

      t.afterEach(({ context }) => {
        expect(context.a).toBe(4);
        context.a++;
      });

      t.after(({ context }) => {
        expect(context.a).toBe(1);
      });
    });

    return runner.run().then(() => {
      expect(results.pop().status).toBe("passed");
    });
  });
});
