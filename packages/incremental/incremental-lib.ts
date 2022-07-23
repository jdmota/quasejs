// Computations are functions
// They accept arguments and produce results
// The arguments and results may be serialized and deserialized
// They may also be associated with equality functions to avoid unnecessary recomputations
// The computations also have an implementation version so that results cached in disk can be invalidated if the plugin gets a new versions
// Since computations may be asynchronous, to ensure determinism, they may only depend on other computations and on the arguments (which must remain immutable)
// Circular dependencies are detected at runtime
// Dirty dependencies should be reexecuted in topological order

// TODO how to optimize operations on graphs for example? or working over sets of files, sorting, and stuff?
// THE ISSUE WITH COLLECTIONS: let's suppose we have some form of coarse grained control over caching
// If some dependency changes, we might decide to reexecute the function again from the beginning.
// But of course, if we call other functions, we want to reuse their old call graph
// Maybe what we need is a way to say: reexecute this but reuse this execution graph
// The same could happen with collections: e.g. pass this collection to a method, but take into account what actually changed
// Implementation idea: Or, when the collection is created, the old one is in the back and being compared as it goes.
// The user controls this heuristic

// feature: interrupt execution

import { from } from "ix/asynciterable";
import { filter, map } from "ix/asynciterable/operators";
import { DefaultMap } from "./default-map";

type Defer<T> = {
  readonly resolve: (value: T | PromiseLike<T>) => void;
  readonly reject: (error: Error) => void;
  readonly promise: Promise<T>;
};

function defer<T>(): Defer<T> {
  let resolve, reject;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return {
    //@ts-ignore
    resolve,
    //@ts-ignore
    reject,
    promise,
  };
}

type JobPoolOptions<Req, Res> = {
  readonly exec: (req: Req) => Promise<Res>;
  readonly reqToStr: (req: Req) => string;
  readonly resToReqs: (res: Res) => Iterable<Req>;
};

export class JobPool<Req, Res> {
  private opts: JobPoolOptions<Req, Res>;
  private cache: Map<string, [Req, Promise<Res>]>;
  private pending: number;
  private notify: Defer<void>;
  private buffer: ([Req, Res] | null)[];

  constructor(opts: JobPoolOptions<Req, Res>) {
    this.opts = opts;
    this.cache = new Map();
    this.pending = 0;
    this.notify = defer();
    this.buffer = [];
  }

  private cacheGet(req: Req) {
    const key = this.opts.reqToStr(req);
    let value = this.cache.get(key);
    if (value == null) {
      this.pending++;

      const job = this.opts.exec(req);
      job.then(res => {
        this.buffer.push([req, res]);

        const moreReqs = this.opts.resToReqs(res);
        for (const req of moreReqs) {
          this.cacheGet(req);
        }

        this.pending--;
        if (this.pending === 0) {
          this.buffer.push(null);
        }

        this.notify.resolve();
      });

      this.cache.set(key, [req, job]);
    }
  }

  async *start(entryRequest: Req) {
    this.cacheGet(entryRequest);

    let loop = true;

    while (loop) {
      await (this.notify = defer()).promise;

      while (this.buffer.length > 0) {
        const result = this.buffer.shift();
        if (result == null) {
          loop = false;
        } else {
          yield result;
        }
      }
    }
  }
}

async function main() {
  const pool = new JobPool<{ number: number }, { next: number }>({
    exec: async req => {
      if (req.number > 50) {
        return {
          next: -1,
        };
      }
      return {
        next: req.number + 1,
      };
    },
    reqToStr: req => `${req.number}`,
    resToReqs: res => (res.next < 0 ? [] : [{ number: res.next }]),
  });

  const source = pool.start({ number: 0 });

  const results = from(source).pipe(
    filter(x => x[0].number % 2 === 0),
    map(x => x)
  );

  for await (const item of results) {
    console.log(item);
  }

  console.log("Done!");
}

main();
