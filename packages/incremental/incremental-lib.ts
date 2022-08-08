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
import { createGraphTemplate } from "./utils/graph";
import { HashMap, ReadonlyHashMap } from "./utils/hash-map";
import { IdentityMap } from "./utils/identity-map";
import { LinkedList, SpecialQueue } from "./utils/linked-list";

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

type Result<T, E = unknown> =
  | {
      type: "ok";
      value: T;
    }
  | {
      type: "error";
      error: E;
    };

function ok<T, E = unknown>(value: T): Result<T, E> {
  return { type: "ok", value };
}

function error<T, E>(error: E): Result<T, E> {
  return { type: "error", error };
}

enum State {
  PENDING = 0,
  RUNNING = 1,
  ERRORED = 2,
  DONE = 3,
  DELETED = 4,
  CREATING = 5,
}

type StateNotCreating =
  | State.PENDING
  | State.RUNNING
  | State.ERRORED
  | State.DONE
  | State.DELETED;

type StateNotDeleted =
  | State.PENDING
  | State.RUNNING
  | State.ERRORED
  | State.DONE
  | State.CREATING;

type RunId = {
  readonly __opaque__: unique symbol;
};

function newRunId() {
  return {} as RunId;
}

function transferSetItems<T>(from: Set<T>, to: Set<T>) {
  for (const e of from) {
    to.add(e);
  }
  from.clear();
}

type ValueDefinition<T> = {
  readonly equal: (a: T, b: T) => boolean;
  readonly hash: (a: T) => number;
  readonly serialize: (a: T) => Buffer;
  readonly deserialize: (a: Buffer) => T;
};

const undefinedValue: ValueDefinition<undefined> = {
  equal: (a, b) => true,
  hash: a => 0,
  serialize: () => Buffer.from([]),
  deserialize: () => undefined,
};

const readonlyHashMapValue: ValueDefinition<ReadonlyHashMap<any, any>> = {
  equal: (a, b) => a === b,
  hash: a => 0,
  serialize: () => Buffer.from([]),
  deserialize: () => {
    throw new Error("never");
  },
};

type ComputationExec<Ctx, Res> = (ctx: Ctx) => Promise<Result<Res>>;

type ComputationEvents<Ctx, Req, Res> = {
  readonly stateChange: (
    c: Computation<Ctx, Req, Res>,
    from: StateNotDeleted,
    to: StateNotCreating
  ) => void;
  readonly finished: (request: Req, result: Result<Res>) => void;
  readonly deleted: (request: Req) => void;
};

export type ComputationDefinition<Ctx, Req, Res> = {
  readonly exec: ComputationExec<Ctx, Res>;
  readonly requestDef: ValueDefinition<Req>;
  readonly responseDef: ValueDefinition<Res>;
  readonly makeContext: (ctx: {
    readonly get: <T>(dep: Computation<any, any, T>) => Promise<Result<T>>;
    readonly compute: (dep: AnyComputation) => void;
    readonly request: Req;
  }) => Ctx;
  readonly events?: ComputationEvents<Ctx, Req, Res> | undefined;
};

type AnyComputation = Computation<any, any, any>;

class Computation<Ctx, Req, Res> {
  public readonly registry: ComputationRegistry;
  public readonly definition: ComputationDefinition<Ctx, Req, Res>;
  public readonly request: Req;
  private state: State;
  private runId: RunId | null;
  private running: Promise<Result<Res>> | null;
  private result: Result<Res> | null;
  private readonly dependencies: Set<AnyComputation>;
  private readonly subscribers: Set<AnyComputation>;
  private readonly oldSubscribers: Set<AnyComputation>;
  private readonly owners: Set<AnyComputation>;
  private readonly owned: Set<AnyComputation>;

  // Requirements of SpecialLinkedList
  public prev: AnyComputation | null;
  public next: AnyComputation | null;

  constructor(
    registry: ComputationRegistry,
    definition: ComputationDefinition<Ctx, Req, Res>,
    request: Req
  ) {
    this.registry = registry;
    this.definition = definition;
    this.request = request;
    this.state = State.CREATING;
    this.runId = null;
    this.running = null;
    this.result = null;
    this.dependencies = new Set();
    this.subscribers = new Set();
    this.oldSubscribers = new Set();
    this.owners = new Set();
    this.owned = new Set();
    this.prev = null;
    this.next = null;
    this.mark(State.PENDING);
  }

  private inv() {
    if (this.state === State.DELETED) {
      throw new Error("Unexpected deleted computation");
    }
  }

  peekError() {
    if (this.result?.type === "error") {
      return this.result.error;
    }
    throw new Error("Assertion error: no error");
  }

  private equals(prev: Result<Res>, next: Result<Res>): boolean {
    if (prev.type === "ok") {
      return (
        next.type === "ok" &&
        this.definition.responseDef.equal(prev.value, next.value)
      );
    }
    if (prev.type === "error") {
      return next.type === "error" && prev.error === next.error;
    }
    return false;
  }

  subscribe(dep: AnyComputation) {
    this.inv();
    dep.inv();

    this.dependencies.add(dep);
    dep.subscribers.add(this);
  }

  unsubscribe(dep: AnyComputation) {
    this.dependencies.delete(dep);
    dep.subscribers.delete(this);
    dep.oldSubscribers.delete(this);
  }

  own(comp: AnyComputation) {
    this.inv();
    comp.inv();

    this.owned.add(comp);
    comp.owners.add(this);
  }

  unown(comp: AnyComputation) {
    this.owned.delete(comp);
    comp.owners.delete(this);
  }

  private after(result: Result<Res>, runId: RunId): Result<Res> {
    if (this.runId === runId) {
      const old = this.result;
      this.result = result;

      if (old != null && this.equals(old, result)) {
        transferSetItems(this.oldSubscribers, this.subscribers);
      } else {
        this.invalidateSubs(this.oldSubscribers);
        this.definition.events?.finished(this.request, result);
      }

      this.mark(result.type === "error" ? State.ERRORED : State.DONE);
    }
    return result;
  }

  private getDep<T>(
    dep: Computation<any, any, T>,
    runId: RunId
  ): Promise<Result<T>> {
    if (runId === this.runId) {
      this.subscribe(dep);
      return dep.run();
    }
    throw new Error("Computation was cancelled");
  }

  private compute(computation: AnyComputation, runId: RunId) {
    if (runId === this.runId) {
      this.own(computation);
    }
    throw new Error("Computation was cancelled");
  }

  private async run(): Promise<Result<Res>> {
    this.inv();
    if (!this.running) {
      const { exec } = this.definition;
      const runId = newRunId();
      this.runId = runId;
      this.running = exec(
        this.definition.makeContext({
          get: dep => this.getDep(dep, runId),
          compute: c => this.compute(c, runId),
          request: this.request,
        })
      ).then(
        v => this.after(v, runId),
        e => this.after(error(e), runId)
      );
      this.mark(State.RUNNING);
    }
    return this.running;
  }

  wait() {
    return this.running;
  }

  invalidate() {
    this.inv();
    this.runId = null;
    this.running = null;
    this.disconnectFromDeps();
    this.disconnectFromOwned();
    // Delay invalidation of subscribers
    transferSetItems(this.subscribers, this.oldSubscribers);
    this.mark(State.PENDING);
  }

  private invalidateSubs(subs: ReadonlySet<AnyComputation>) {
    for (const sub of subs) {
      sub.invalidate();
    }
  }

  private disconnectFromDeps() {
    for (const dep of this.dependencies) {
      this.unsubscribe(dep);
    }
  }

  private disconnectFromOwned() {
    for (const owned of this.owned) {
      this.unown(owned);
    }
  }

  // pre: this.isOrphan()
  destroy() {
    this.inv();
    this.runId = null;
    this.running = null;
    this.result = null;
    this.disconnectFromDeps();
    this.disconnectFromOwned();
    this.definition.events?.deleted(this.request);
    this.mark(State.DELETED);
  }

  private mark(state: StateNotCreating) {
    const prevState = this.state;
    if (prevState === State.DELETED) {
      throw new Error("Unexpected deleted computation");
    }
    if (prevState !== State.CREATING) {
      this.registry.computations[prevState].delete(this);
    }
    if (state === State.DELETED) {
      this.registry.delete(this);
    } else {
      this.registry.computations[state].add(this);
    }
    this.state = state;
    this.definition.events?.stateChange(this, prevState, state);
  }

  private isOrphan(): boolean {
    return (
      this.subscribers.size === 0 &&
      this.oldSubscribers.size === 0 &&
      this.owners.size === 0
    );
  }

  maybeRun() {
    if (this.isOrphan()) {
      // this.destroy();
    } else {
      this.run();
    }
  }
}

type ComputationMapEntryContext<Req> = {
  readonly get: <T>(dep: Computation<any, any, T>) => Promise<Result<T>>;
  readonly compute: (req: Req) => void;
};

type ComputationMapContext<Req> = {
  readonly get: <T>(dep: Computation<any, any, T>) => Promise<Result<T>>;
  readonly compute: (req: Req) => void;
  readonly request: Req;
};

type ComputationExitMapContext = {
  readonly get: <T>(dep: Computation<any, any, T>) => Promise<Result<T>>;
};

export type ComputationMapDefinition<Req, Res> = {
  readonly entryExec: ComputationExec<
    ComputationMapEntryContext<Req>,
    undefined
  >;
  readonly exec: ComputationExec<ComputationMapContext<Req>, Res>;
  readonly requestDef: ValueDefinition<Req>;
  readonly responseDef: ValueDefinition<Res>;
};

class ComputationMap<Req, Res> {
  public readonly registry: ComputationRegistry;
  public readonly definition: ComputationMapDefinition<Req, Res>;
  private readonly resultsMap: HashMap<Req, Result<Res>>;
  private readonly entry: Computation<
    ComputationMapEntryContext<Req>,
    undefined,
    undefined
  >;
  private readonly computationsDefinition: ComputationDefinition<
    ComputationMapContext<Req>,
    Req,
    Res
  >;
  private readonly exit: Computation<
    ComputationExitMapContext,
    undefined,
    ReadonlyHashMap<Req, Result<Res>>
  >;
  private readonly status: [number, number, number, number];
  private deferred: Defer<null> | null;

  constructor(
    registry: ComputationRegistry,
    definition: ComputationMapDefinition<Req, Res>
  ) {
    this.registry = registry;
    this.definition = definition;
    this.resultsMap = new HashMap<Req, Result<Res>>(
      this.definition.requestDef.hash,
      this.definition.requestDef.equal
    );
    this.entry = registry.make(
      {
        exec: definition.entryExec,
        requestDef: undefinedValue,
        responseDef: undefinedValue,
        makeContext: ctx => ({
          get: ctx.get,
          compute: req => ctx.compute(this.make(req)),
        }),
      },
      undefined
    );
    this.status = [0, 0, 0, 0];
    this.deferred = defer();
    this.computationsDefinition = {
      exec: definition.exec,
      requestDef: definition.requestDef,
      responseDef: definition.responseDef,
      makeContext: ctx => ({
        get: ctx.get,
        compute: req => ctx.compute(this.make(req)),
        request: ctx.request,
      }),
      events: {
        stateChange: (_, from, to) => {
          if (from !== State.CREATING) {
            this.status[from]--;
          }
          if (to !== State.DELETED) {
            this.status[to]--;
          }
        },
        finished: (req, result) => {
          this.resultsMap.set(req, result);
          this.propagateChanges();
        },
        deleted: req => {
          this.resultsMap.delete(req);
          this.propagateChanges();
        },
      },
    };
    this.exit = registry.make(
      {
        exec: async ctx => {
          await ctx.get(this.entry);
          await this.waitIsDone();
          return ok(this.resultsMap);
        },
        requestDef: undefinedValue,
        responseDef: readonlyHashMapValue,
        makeContext: ctx => ({
          get: ctx.get,
        }),
      },
      undefined
    );
  }

  private make(request: Req) {
    return this.registry.make(this.computationsDefinition, request);
  }

  private isDone() {
    return this.status[State.PENDING] + this.status[State.RUNNING] === 0;
  }

  private async waitIsDone() {
    if (!this.isDone()) {
      await (this.deferred = defer()).promise;
    }
  }

  private propagateChanges() {
    //TODO what if exit is running? and waiting? or running a previous version? what if it did not start yet?
    if (this.isDone()) {
      const { deferred } = this;
      if (deferred) {
        this.deferred = null;
        deferred.resolve(null);
      }
    }
  }

  destroy() {
    this.registry.delete(this.entry);
    this.registry.delete(this.exit);
  }

  getExitComputation() {
    return this.exit;
  }
}

export class ComputationRegistry {
  private map: IdentityMap<
    ComputationDefinition<any, any, any>,
    HashMap<any, AnyComputation>
  >;
  readonly computations: readonly [
    SpecialQueue<AnyComputation>,
    SpecialQueue<AnyComputation>,
    SpecialQueue<AnyComputation>,
    SpecialQueue<AnyComputation>
  ];
  private readonly pending: SpecialQueue<AnyComputation>;
  private readonly running: SpecialQueue<AnyComputation>;
  private readonly errored: SpecialQueue<AnyComputation>;
  private interrupted: boolean;

  constructor() {
    this.map = new IdentityMap();
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

  make<Ctx, Req, Res>(
    definition: ComputationDefinition<Ctx, Req, Res>,
    request: Req
  ): Computation<Ctx, Req, Res> {
    return this.map
      .computeIfAbsent(
        definition,
        d => new HashMap(d.requestDef.hash, d.requestDef.equal)
      )
      .computeIfAbsent(
        request,
        request => new Computation(this, definition, request)
      );
  }

  delete(c: AnyComputation) {
    this.map.get(c.definition)?.delete(c.request);
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
  // TODO deleted unneeed computations
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
