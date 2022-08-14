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

import { from } from "ix/asynciterable";
import { filter, map } from "ix/asynciterable/operators";
import { Defer, createDefer, Notifier, createNotifier } from "./utils/deferred";
import {
  ValueDefinition,
  HashMap,
  ReadonlyHandlerHashMap,
} from "./utils/hash-map";
import { SpecialQueue } from "./utils/linked-list";
import {
  RawComputation,
  AnyRawComputation,
  State,
  StateNotDeleted,
  StateNotCreating,
  RunId,
} from "./computations/raw";
import { AnyComputation, Computation } from "./computations/subscribable";
import {
  AnyComputationWithChildren,
  ComputationWithChildren,
} from "./computations/with-children";

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

export type Result<T, E = unknown> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: E;
    };

export function ok<T, E = unknown>(value: T): Result<T, E> {
  return { ok: true, value };
}

export function error<T, E>(error: E): Result<T, E> {
  return { ok: false, error };
}

const anyValue: ValueDefinition<any> = {
  equal: (a, b) => a === b,
  hash: _ => 0,
};

export type ComputationDescription<C extends AnyRawComputation> = {
  readonly create: (registry: ComputationRegistry) => C;
  readonly equal: <O extends AnyRawComputation>(
    other: ComputationDescription<O>
  ) => boolean;
  readonly hash: () => number;
};

export class ComputationRegistry {
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
  private interrupted: boolean;

  constructor() {
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
    this.interrupted = false;
  }

  make<C extends AnyRawComputation>(description: ComputationDescription<C>): C {
    return this.map.computeIfAbsent(description, d => d.create(this)) as C;
  }

  delete(c: AnyRawComputation) {
    this.map.delete(c.description);
  }

  interrupt() {
    this.interrupted = true;
  }

  wasInterrupted(): boolean {
    return this.interrupted;
  }

  private hasPending(): boolean {
    return (
      !this.interrupted && !(this.pending.isEmpty() && this.running.isEmpty())
    );
  }

  // TODO topological order
  // TODO To avoid circular dependencies, we can force each computation to state the types of computations it will depend on. This will force the computation classes to be defined before the ones that will depend on it.
  // TODO delete unneeed computations
  async run(): Promise<unknown[]> {
    const errors: unknown[] = [];

    this.interrupted = false;

    for (const c of this.errored.keepTaking()) {
      c.invalidate();
    }

    while (this.hasPending()) {
      for (const c of this.pending.keepTaking()) {
        c.maybeRun();
      }

      await this.running.peek()?.wait();
    }

    for (const c of this.errored.iterateAll()) {
      errors.push(c.peekError());
    }

    return errors;
  }
}
