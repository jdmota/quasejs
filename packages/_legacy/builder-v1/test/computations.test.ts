/// <reference types="jest" />
import {
  ComputationRegistry,
  Computation,
  CValue,
} from "../src/utils/computation-registry";

function defer<T>(): {
  promise: Promise<T>;
  resolve: (val: T) => void;
  reject: (error: Error) => void;
} {
  let resolve, reject;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  promise.catch(() => {});
  return {
    promise,
    // @ts-ignore
    resolve,
    // @ts-ignore
    reject,
  };
}

async function run(r: ComputationRegistry) {
  const errors = await r.run();
  return errors.map(e => e.message);
}

function computationMatches<T>(
  comp: Computation<T>,
  match: {
    subscribers: Computation<any>[];
    oldSubscribers: Computation<any>[];
    dependencies: Computation<any>[];
  }
) {
  expect(comp).toMatchObject({
    subscribers: new Set(match.subscribers),
    oldSubscribers: new Set(match.oldSubscribers),
    dependencies: new Set(match.dependencies),
  });
}

class C extends Computation<{ n: number }> {
  private fn: (c: C) => Promise<number> | number;
  public times: number;

  constructor(
    registry: ComputationRegistry,
    fn: (c: C) => Promise<number> | number
  ) {
    super(registry);
    this.fn = fn;
    this.times = 0;
  }

  equals(old: { n: number }, val: { n: number }) {
    return old.n === val.n;
  }

  async run() {
    this.times++;
    const fn = this.fn;
    try {
      const n: number = await fn(this);
      const ret = [{ n }, null] as CValue<{ n: number }>;
      return ret;
    } catch (error) {
      const ret = [null, error] as CValue<{ n: number }>;
      return ret;
    }
  }

  async getVal(dep: C): Promise<number> {
    const [value, error] = await this.getDep(dep);
    if (error) {
      throw error;
    }
    return value!
      .n; /* eslint-disable-line @typescript-eslint/no-non-null-assertion */
  }

  peek() {
    return this.peekValue().n;
  }
}

describe("computations", () => {
  it("basic multiplication", async () => {
    const r = new ComputationRegistry();

    const a = new C(r, () => 2);

    const b = new C(r, () => 3);

    const c = new C(r, async c => {
      return (await c.getVal(a)) * (await c.getVal(b));
    });

    expect(await run(r)).toEqual([]);
    expect(c.peek()).toEqual(6);

    computationMatches(a, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(b, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(c, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [a, b],
    });
  });

  it("basic invalidation", async () => {
    const r = new ComputationRegistry();

    let aVal = 2;
    const a = new C(r, () => aVal);

    const b = new C(r, () => 3);

    const c = new C(r, async c => {
      return (await c.getVal(a)) * (await c.getVal(b));
    });

    expect(await run(r)).toEqual([]);

    expect(c.peek()).toEqual(6);

    computationMatches(a, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(b, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(c, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [a, b],
    });

    a.invalidate();
    aVal = 3;

    expect(await run(r)).toEqual([]);

    expect(c.peek()).toEqual(9);

    computationMatches(a, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(b, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(c, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [a, b],
    });
  });

  it("deleted computation", async () => {
    const r = new ComputationRegistry();

    const a = new C(r, () => 2);

    const b = new C(r, () => 3);

    const c = new C(r, async c => {
      return (await c.getVal(a)) * (await c.getVal(b));
    });

    expect(await run(r)).toEqual([]);
    expect(c.peek()).toEqual(6);

    computationMatches(a, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(b, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(c, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [a, b],
    });

    c.destroy();

    computationMatches(a, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(b, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [],
    });
  });

  it("deleted computation with subscribers", async () => {
    const r = new ComputationRegistry();

    const a = new C(r, () => 2);

    const b = new C(r, () => 3);

    const c = new C(r, async c => {
      return (await c.getVal(a)) * (await c.getVal(b));
    });

    const d = new C(r, d => {
      return d.getVal(c);
    });

    expect(await run(r)).toEqual([]);
    expect(d.peek()).toEqual(6);

    computationMatches(a, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(b, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(c, {
      subscribers: [d],
      oldSubscribers: [],
      dependencies: [a, b],
    });

    computationMatches(d, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [c],
    });

    c.destroy();

    computationMatches(a, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(b, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(d, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [],
    });
  });

  it("delete running computation", async () => {
    const r = new ComputationRegistry();

    const aDefer = defer<number>();

    const a = new C(r, () => aDefer.promise);

    const p = run(r);

    a.destroy();

    expect(r.isPending()).toBe(false);

    aDefer.resolve(10);

    expect(await p).toEqual([]);

    expect(r.isPending()).toBe(false);
  });

  it("trying to get deleted computation", async () => {
    const r = new ComputationRegistry();

    const a = new C(r, () => 2);

    const b = new C(r, () => 3);

    const c = new C(r, async c => {
      return (await c.getVal(a)) * (await c.getVal(b));
    });

    const d = new C(r, d => {
      return d.getVal(c);
    });

    expect(await run(r)).toEqual([]);

    expect(d.peek()).toEqual(6);

    computationMatches(a, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(b, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(c, {
      subscribers: [d],
      oldSubscribers: [],
      dependencies: [a, b],
    });

    computationMatches(d, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [c],
    });

    c.destroy();

    computationMatches(a, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(b, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(d, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [],
    });

    expect(await run(r)).toEqual(["That computation was deleted"]);
  });

  it("don't invalidate subscribers if same value", async () => {
    const r = new ComputationRegistry();

    const a = new C(r, () => 2);

    const b = new C(r, () => 3);

    const c = new C(r, async c => {
      return (await c.getVal(a)) * (await c.getVal(b));
    });

    expect(await run(r)).toEqual([]);

    expect(c.peek()).toEqual(6);

    expect(a.times).toEqual(1);
    expect(b.times).toEqual(1);
    expect(c.times).toEqual(1);

    computationMatches(a, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(b, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(c, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [a, b],
    });

    a.invalidate();

    expect(await run(r)).toEqual([]);

    expect(c.peek()).toEqual(6);

    expect(a.times).toEqual(2);
    expect(b.times).toEqual(1);
    expect(c.times).toEqual(1);

    computationMatches(a, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(b, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(c, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [a, b],
    });
  });

  it("computation cancels itself", async () => {
    const r = new ComputationRegistry();

    let invalidatedB = false;

    const a = new C(r, () => 10);

    const b = new C(r, async b => {
      await null;
      if (!invalidatedB) {
        b.invalidate();
        invalidatedB = true;
        return 0;
      }
      return b.getVal(a);
    });

    const p = run(r);

    r.interrupt();

    expect(await p).toEqual([]);

    expect(await run(r)).toEqual([]);

    expect(b.peek()).toEqual(10);

    expect(a.times).toEqual(1);
    expect(b.times).toEqual(2);

    computationMatches(a, {
      subscribers: [b],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(b, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [a],
    });
  });

  it("interruption 1", async () => {
    const r = new ComputationRegistry();

    let aDefer = defer<number>();

    const a = new C(r, () => aDefer.promise);

    const b = new C(r, () => 3);

    const c = new C(r, async c => {
      return (await c.getVal(a)) * (await c.getVal(b));
    });

    setTimeout(() => {
      aDefer.reject(new Error("error"));
    }, 10);

    const p = run(r);

    r.interrupt();

    expect(await p).toEqual(["error"]);

    aDefer = defer<number>();
    aDefer.resolve(2);

    expect(await run(r)).toEqual([]);

    expect(c.peek()).toEqual(6);

    expect(a.times).toEqual(2);
    expect(b.times).toEqual(1);
    expect(c.times).toEqual(2);

    computationMatches(a, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(b, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(c, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [a, b],
    });
  });

  it("interruption 2", async () => {
    const r = new ComputationRegistry();

    let aDefer = defer<number>();

    const a = new C(r, () => aDefer.promise);

    const b = new C(r, () => 3);

    const c = new C(r, async c => {
      return (await c.getVal(a)) * (await c.getVal(b));
    });

    const d = new C(r, d => {
      return d.getVal(c);
    });

    setTimeout(() => {
      aDefer.reject(new Error("error"));
    }, 10);

    const p = run(r);

    r.interrupt();

    expect(r.wasInterrupted()).toBe(true);

    expect(await p).toEqual(["error"]);

    aDefer = defer<number>();
    aDefer.resolve(2);

    expect(await run(r)).toEqual([]);

    expect(d.peek()).toEqual(6);

    expect(a.times).toEqual(2);
    expect(b.times).toEqual(1);
    expect(c.times).toEqual(2);
    expect(d.times).toEqual(2);

    computationMatches(a, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(b, {
      subscribers: [c],
      oldSubscribers: [],
      dependencies: [],
    });

    computationMatches(c, {
      subscribers: [d],
      oldSubscribers: [],
      dependencies: [a, b],
    });

    computationMatches(d, {
      subscribers: [],
      oldSubscribers: [],
      dependencies: [c],
    });
  });

  it("thrown error", async () => {
    const r = new ComputationRegistry();

    class C2 extends Computation<void> {
      async run(_: void, _2: () => void): Promise<CValue<void>> {
        throw new Error("Error");
      }
    }

    const a = new C2(r);

    expect(await run(r)).toEqual(["Error"]);
    expect(a.peekError()).toMatchObject({
      message: "Error",
    });
  });
});
