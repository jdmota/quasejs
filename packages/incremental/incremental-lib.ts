// Computations are functions
// They accept arguments and produce results
// The arguments and results may be serialized and deserialized
// They may also be associated with equality functions to avoid unnecessary recomputations
// The computations also have an implementation version so that results cached in disk can be invalidated if the plugin gets a new versions
// Since computations may be asynchronous, to ensure determinism, they may only depend on other computations and on the arguments (which must remain immutable)
// Circular dependencies are detected at runtime
// Dirty dependencies should be reexecuted in topological order

// How to optimize operations on graphs for example? or working over sets of files, sorting, and stuff?
// THE ISSUE WITH COLLECTIONS: let's suppose we have some form of coarse grained control over caching
// If some dependency changes, we might decide to reexecute the function again from the beginning.
// But of course, if we call other functions, we want to reuse their old call graph
// Maybe what we need is a way to say: reexecute this but reuse this execution graph
// The same could happen with collections: e.g. pass this collection to a method, but take into account what actually changed
// Implementation idea: Or, when the collection is created, the old one is in the back and being compared as it goes.
// The user controls this heuristic

// feature: interrupt execution

// OBJECTIVE: graph building, operations on the graph to produce new graphs, queries on the graph, all with reactivity

// We have computations which store their last value, and computations that emit events but do not store them?

// import { from } from "ix/asynciterable";
// import { filter, map } from "ix/asynciterable/operators";
import { Defer, createDefer } from "./utils/deferred";
import { ValueDefinition, HashMap } from "./utils/hash-map";
import { SpecialQueue } from "./utils/linked-list";
import { AnyRawComputation, State } from "./computations/raw";
import {
  newSimpleComputation,
  SimpleComputationExec,
} from "./computations/simple";
import { Result } from "./utils/result";
import { BasicComputation } from "./computations/basic";
import { Scheduler } from "./utils/schedule";

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
    this.notify = createDefer();
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
      await (this.notify = createDefer()).promise;

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

  /*const results = from(source).pipe(
    filter(x => x[0].number % 2 === 0),
    map(x => x)
  );*/

  for await (const item of source) {
    console.log(item);
  }

  console.log("Done!");
}

// main();

// ########################

const determinismSym = Symbol("deterministic");

type DeterministicFunc<Arg, Ret> = {
  readonly [determinismSym]: (arg: Arg) => Ret;
};

function deterministic<Arg, Ret>(
  func: (arg: Arg) => Ret
): DeterministicFunc<Arg, Ret> {
  return {
    [determinismSym]: func,
  };
}

export type ComputationDescription<C extends AnyRawComputation> = {
  readonly create: (registry: ComputationRegistry) => C;
  readonly equal: <O extends AnyRawComputation>(
    other: ComputationDescription<O>
  ) => boolean;
  readonly hash: () => number;
};

type ComputationRegistryOpts = {
  readonly canInvalidate: boolean;
};

export class ComputationRegistry {
  private readonly canInvalidate: boolean;
  private canExternalInvalidate: boolean;
  private map: HashMap<ComputationDescription<any>, AnyRawComputation>;
  readonly computations: readonly [
    SpecialQueue<AnyRawComputation>,
    SpecialQueue<AnyRawComputation>,
    SpecialQueue<AnyRawComputation>,
    SpecialQueue<AnyRawComputation>
  ];
  private readonly pending: SpecialQueue<AnyRawComputation>;
  private readonly running: SpecialQueue<AnyRawComputation>;
  private readonly errored: SpecialQueue<AnyRawComputation>;

  private constructor(opts: ComputationRegistryOpts) {
    this.canInvalidate = opts.canInvalidate;
    this.canExternalInvalidate = opts.canInvalidate;
    this.map = new HashMap({
      equal: (a, b) => a.equal(b),
      hash: a => a.hash(),
    });
    this.computations = [
      new SpecialQueue(),
      new SpecialQueue(),
      new SpecialQueue(),
      new SpecialQueue(),
    ];
    this.pending = this.computations[State.PENDING];
    this.running = this.computations[State.RUNNING];
    this.errored = this.computations[State.ERRORED];
  }

  private computationsCount() {
    return this.map.size();
  }

  invalidationsAllowed() {
    return this.canInvalidate;
  }

  externalInvalidationsAllowed() {
    return this.canExternalInvalidate;
  }

  private disableExternalInvalidations() {
    this.canExternalInvalidate = false;
  }

  make<C extends AnyRawComputation>(description: ComputationDescription<C>): C {
    return this.map.computeIfAbsent(description, d => d.create(this)) as C;
  }

  delete(c: AnyRawComputation) {
    this.map.delete(c.description);
  }

  private scheduler1 = new Scheduler(() => this.wake(), 100);
  private scheduler2 = new Scheduler(() => {
    this.invalidateErrored();
    this.wake();
  }, 200);

  scheduleWake() {
    this.scheduler1.schedule();
  }

  wake() {
    this.scheduler1.cancel();

    // Since invalidations of a computation:
    // - do not immediately invalidate the subscribers and
    // - disconnect it from dependencies
    // and since there is memoing,
    // we actually do not need to start these in topological order.
    // Since some computations might not be removed from the "pending" set,
    // in case they have no dependents, we use Array.from first.
    for (const c of Array.from(this.pending.iterateAll())) {
      c.maybeRun();
    }
  }

  // External invalidations, like those caused by file changes,
  // invalidate errored computations (to overcome sporadic errors),
  // and schedule a new execution
  externalInvalidate(computation: AnyRawComputation) {
    if (this.externalInvalidationsAllowed()) {
      computation.invalidate();
      this.scheduler2.schedule();
    }
  }

  private invalidateErrored() {
    for (const c of this.errored.keepTaking()) {
      c.invalidate();
    }
  }

  private async wait() {
    while (!this.pending.isEmpty() || !this.running.isEmpty()) {
      this.wake();
      await this.running.peek()?.run();
    }
  }

  // TODO To avoid circular dependencies, we can force each computation to state the types of computations it will depend on. This will force the computation classes to be defined before the ones that will depend on it.
  // TODO delete unneeed computations during execution?
  // TODO peek errors and return a list of them? create a error pool and report only those?
  // TODO maybe distinguish sporadic errors from non-sporadic ones?
  /*
    for (const c of this.errored.iterateAll()) {
      errors.push(c.peekError());
    }
  */

  private cleanupRun(computation: BasicComputation<undefined, any>) {
    computation.unroot();
    computation.destroy();
    let count;
    do {
      count = this.computationsCount();
      for (const c of Array.from(this.map.values())) {
        c.maybeDestroy();
      }
    } while (this.computationsCount() < count);

    if (this.computationsCount() > 0) {
      throw new Error("Invariant violation: Cleanup failed");
    }
  }

  static async singleRun<T>(
    exec: SimpleComputationExec<T>
  ): Promise<Result<T>> {
    const registry = new ComputationRegistry({ canInvalidate: false });
    const desc = newSimpleComputation({ exec, root: true });
    const computation = registry.make(desc);
    const result = await computation.run();
    registry.cleanupRun(computation);
    return result;
  }

  static run<T>(exec: SimpleComputationExec<T>): ComputationController<T> {
    const defer = createDefer<Result<T>>();
    const registry = new ComputationRegistry({ canInvalidate: true });
    const desc = newSimpleComputation({ exec, root: true });
    const computation = registry.make(desc);
    registry.wake();

    return {
      promise: defer.promise,
      interrupt() {
        registry.cleanupRun(computation);
        defer.reject(new Error("Interrupted"));
      },
      finish() {
        if (registry.externalInvalidationsAllowed()) {
          registry.disableExternalInvalidations();
          registry.invalidateErrored();
          registry
            .wait()
            .then(async () => {
              const result = await computation.run();
              registry.cleanupRun(computation);
              return result;
            })
            .then(defer.resolve, defer.reject);
        }
      },
    };
  }
}

type ComputationController<T> = {
  readonly promise: Promise<Result<T>>;
  readonly interrupt: () => void;
  readonly finish: () => void;
};
