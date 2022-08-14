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
import { Defer, createDefer, Notifier, createNotifier } from "./utils/deferred";
import {
  ValueDefinition,
  HashMap,
  ReadonlyHashMap,
  ReadonlyHandlerHashMap,
} from "./utils/hash-map";
import { IdentityMap } from "./utils/identity-map";
import { LinkedList, SpecialQueue } from "./utils/linked-list";

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

type Result<T, E = unknown> =
  | {
      ok: true;
      value: T;
    }
  | {
      ok: false;
      error: E;
    };

function ok<T, E = unknown>(value: T): Result<T, E> {
  return { ok: true, value };
}

function error<T, E>(error: E): Result<T, E> {
  return { ok: false, error };
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

const anyValue: ValueDefinition<any> = {
  equal: (a, b) => a === b,
  hash: _ => 0,
};

type ComputationExec<Ctx, Res> = (ctx: Ctx) => Promise<Result<Res>>;

export type ComputationDefinition<Ctx, Req, Res> = {
  readonly create: (
    registry: ComputationRegistry,
    definition: ComputationDefinition<Ctx, Req, Res>,
    request: Req
  ) => Computation<Ctx, Req, Res>;
  readonly requestDef: ValueDefinition<Req>;
  readonly responseDef: ValueDefinition<Res>;
};

type AnyComputation = Computation<any, any, any>;

abstract class Computation<Ctx, Req, Res> {
  public readonly registry: ComputationRegistry;
  public readonly definition: ComputationDefinition<Ctx, Req, Res>;
  public readonly request: Req;
  // Current state
  private state: State;
  private runId: RunId | null;
  private running: Promise<Result<Res>> | null;
  // Dependencies
  private readonly dependencies: Set<AnyComputation>;
  // The latest result that all subscribers saw
  private result: Result<Res> | null;
  private readonly subscribers: Set<AnyComputation>;
  // If not null, it means all oldSubscribers saw this value
  // It is important to keep oldResult separate from result
  // See invalidate()
  private oldResult: Result<Res> | null;
  private readonly oldSubscribers: Set<AnyComputation>;

  // Requirements of SpecialQueue
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
    this.dependencies = new Set();
    this.result = null;
    this.subscribers = new Set();
    this.oldResult = null;
    this.oldSubscribers = new Set();
    this.prev = null;
    this.next = null;
    this.mark(State.PENDING);
  }

  protected abstract exec(ctx: Ctx): Promise<Result<Res>>;
  protected abstract makeContext(runId: RunId): Ctx;

  protected abstract onFinish(req: Req, result: Result<Res>): void;
  protected abstract onDeleted(req: Req): void;
  protected abstract onStateChange(
    from: StateNotDeleted,
    to: StateNotCreating
  ): void;

  protected inv() {
    if (this.state === State.DELETED) {
      throw new Error("Unexpected deleted computation");
    }
  }

  peekError() {
    if (this.result?.ok === false) {
      return this.result.error;
    }
    throw new Error("Assertion error: no error");
  }

  private equals(prev: Result<Res>, next: Result<Res>): boolean {
    if (prev.ok) {
      return (
        next.ok && this.definition.responseDef.equal(prev.value, next.value)
      );
    }
    if (!prev.ok) {
      return !next.ok && prev.error === next.error;
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

  protected active(runId: RunId) {
    if (runId !== this.runId) {
      throw new Error("Computation was cancelled");
    }
  }

  private after(result: Result<Res>, runId: RunId): Result<Res> {
    if (this.runId === runId) {
      const old = this.oldResult;
      this.oldResult = null;
      this.result = result;

      if (old != null && this.equals(old, result)) {
        transferSetItems(this.oldSubscribers, this.subscribers);
      } else {
        this.invalidateSubs(this.oldSubscribers);
        this.onFinish(this.request, result);
      }

      this.mark(result.ok ? State.DONE : State.ERRORED);
    }
    return result;
  }

  protected getDep<T>(
    dep: Computation<any, any, T>,
    runId: RunId
  ): Promise<Result<T>> {
    this.active(runId);
    this.subscribe(dep);
    return dep.run();
  }

  private async run(): Promise<Result<Res>> {
    this.inv();
    if (!this.running) {
      const { exec } = this;
      const runId = newRunId();
      this.runId = runId;
      this.running = exec(this.makeContext(runId)).then(
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
    // Invalidate previous execution
    this.runId = null;
    this.running = null;
    // If a computation is invalidated, partially executed, and then invalidated again,
    // oldResult will be null.
    // This will cause computations that subcribed in between both invalidations
    // to be propertly invalidated, preserving the invariant
    // that all oldSubscribers should have seen the same oldResult, if not null.
    this.oldResult = this.result;
    this.result = null;
    // Delay invalidation of subscribers
    // by moving them to the list of oldSubscribers.
    transferSetItems(this.subscribers, this.oldSubscribers);
    // Disconnect from dependencies and children computations.
    // The connection might be restored after rerunning this computation.
    // This is fine because our garbage collection of computations
    // only occurs after everything is stable.
    this.disconnect();
    // Update state
    this.mark(State.PENDING);
  }

  private invalidateSubs(subs: ReadonlySet<AnyComputation>) {
    for (const sub of subs) {
      sub.invalidate();
    }
  }

  protected disconnect() {
    for (const dep of this.dependencies) {
      this.unsubscribe(dep);
    }
  }

  // pre: this.isOrphan()
  destroy() {
    this.inv();
    this.runId = null;
    this.running = null;
    this.oldResult = null;
    this.result = null;
    this.disconnect();
    this.onDeleted(this.request);
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
    this.onStateChange(prevState, state);
  }

  protected isOrphan(): boolean {
    return this.subscribers.size === 0 && this.oldSubscribers.size === 0;
  }

  maybeRun() {
    if (this.isOrphan()) {
      // this.destroy();
    } else {
      this.run();
    }
  }
}

type AnyComputationWithChildren = ComputationWithChildren<any, any, any>;

abstract class ComputationWithChildren<Ctx, Req, Res> extends Computation<
  Ctx,
  Req,
  Res
> {
  // Parent computations and children computations
  private readonly owners: Set<AnyComputationWithChildren> = new Set();
  private readonly owned: Set<AnyComputationWithChildren> = new Set();

  constructor(
    registry: ComputationRegistry,
    definition: ComputationDefinition<Ctx, Req, Res>,
    request: Req
  ) {
    super(registry, definition, request);
  }

  own(comp: AnyComputationWithChildren) {
    this.inv();
    comp.inv();

    this.owned.add(comp);
    comp.owners.add(this);
  }

  unown(comp: AnyComputationWithChildren) {
    this.owned.delete(comp);
    comp.owners.delete(this);
  }

  protected compute(computation: AnyComputationWithChildren, runId: RunId) {
    this.active(runId);
    this.own(computation);
  }

  protected disconnect() {
    super.disconnect();

    for (const owned of this.owned) {
      this.unown(owned);
    }
  }

  protected isOrphan(): boolean {
    return super.isOrphan() && this.owners.size === 0;
  }
}

type ComputationMapStartContext<Req> = {
  readonly get: <T>(dep: Computation<any, any, T>) => Promise<Result<T>>;
  readonly compute: (req: Req) => void;
};

type ComputationMapFieldContext<Req> = {
  readonly get: <T>(dep: Computation<any, any, T>) => Promise<Result<T>>;
  readonly compute: (req: Req) => void;
  readonly request: Req;
};

type ComputationMapContext<Req> = {
  readonly active: () => void;
  readonly get: <T>(dep: Computation<any, any, T>) => Promise<Result<T>>;
  readonly compute: (dep: Req) => void;
};

export type ComputationMapDefinition<Req, Res> = {
  readonly startExec: ComputationExec<
    ComputationMapStartContext<Req>,
    undefined
  >;
  readonly exec: ComputationExec<ComputationMapFieldContext<Req>, Res>;
  readonly requestDef: ValueDefinition<Req>;
  readonly responseDef: ValueDefinition<Res>;
};

class ComputationMapField<Req, Res> extends ComputationWithChildren<
  ComputationMapFieldContext<Req>,
  Req,
  Res
> {
  private readonly source: ComputationMap<Req, Res>;

  constructor(
    registry: ComputationRegistry,
    definition: ComputationDefinition<
      ComputationMapFieldContext<Req>,
      Req,
      Res
    >,
    request: Req,
    source: ComputationMap<Req, Res>
  ) {
    super(registry, definition, request);
    this.source = source;
  }

  protected exec(ctx: ComputationMapFieldContext<Req>): Promise<Result<Res>> {
    return this.source.execField(ctx);
  }

  protected makeContext(runId: RunId): ComputationMapFieldContext<Req> {
    return {
      get: dep => this.getDep(dep, runId),
      compute: req => this.compute(this.source.make(req), runId),
      request: this.request,
    };
  }

  protected onFinish(req: Req, result: Result<Res>): void {
    this.source.onFieldFinish(req, result);
  }

  protected onDeleted(req: Req): void {
    this.source.onFieldDeleted(req);
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {
    this.source.onFieldStateChange(from, to);
  }
}

class ComputationMap<Req, Res> extends ComputationWithChildren<
  ComputationMapContext<Req>,
  undefined,
  ReadonlyHandlerHashMap<Req, Result<Res>>
> {
  private readonly mapDefinition: ComputationMapDefinition<Req, Res>;
  private readonly fieldDefinition: ComputationDefinition<
    ComputationMapFieldContext<Req>,
    Req,
    Res
  >;
  private readonly resultsMap: HashMap<Req, Result<Res>>;
  private readonly status: [number, number, number, number];
  private readonly notifier: Notifier<null>;
  private lastSeen: ReadonlyHandlerHashMap<Req, Result<Res>> | null;

  constructor(
    registry: ComputationRegistry,
    definition: ComputationDefinition<
      ComputationMapContext<Req>,
      undefined,
      ReadonlyHandlerHashMap<Req, Result<Res>>
    >,
    request: undefined,
    mapDefinition: ComputationMapDefinition<Req, Res>
  ) {
    super(registry, definition, request);
    this.mapDefinition = mapDefinition;
    this.fieldDefinition = {
      create: (registry, definition, request) =>
        new ComputationMapField(registry, definition, request, this),
      requestDef: mapDefinition.requestDef,
      responseDef: mapDefinition.responseDef,
    };
    this.resultsMap = new HashMap<Req, Result<Res>>(mapDefinition.requestDef);
    this.status = [0, 0, 0, 0];
    this.notifier = createNotifier();
    this.lastSeen = null;
  }

  make(request: Req) {
    return this.registry.make(
      this.fieldDefinition,
      request
    ) as AnyComputationWithChildren;
  }

  private isDone() {
    // TODO cannot rely on this! deletion happens later. how do we know the pending ones are not orphan?
    // In fact, since this will produce a graph (maybe a cyclic one)
    // How to know if some computation should still exist??
    return this.status[State.PENDING] + this.status[State.RUNNING] === 0;
  }

  protected async exec(
    ctx: ComputationMapContext<Req>
  ): Promise<Result<ReadonlyHandlerHashMap<Req, Result<Res>>>> {
    const { startExec } = this.mapDefinition;

    // Wait for the start computation to finish
    await startExec({
      get: ctx.get,
      compute: ctx.compute,
    });

    // Wait for all children computations to finish
    while (!this.isDone()) {
      // Ensure this running version is active before doing side-effects
      ctx.active();
      await this.notifier.wait();
      // In case invalidations occured between notifier.done()
      // and this computation resuming, keep waiting if !isDone()
    }

    ctx.active();
    // Record the last seen version of the results map
    // in the same tick when isDone()
    this.lastSeen = this.resultsMap.getSnapshot();
    return ok(this.lastSeen);
  }

  protected makeContext(runId: RunId): ComputationMapContext<Req> {
    return {
      active: () => this.active(runId),
      get: dep => this.getDep(dep, runId),
      compute: req => this.compute(this.make(req), runId),
    };
  }

  protected onFinish(
    req: undefined,
    result: Result<ReadonlyHandlerHashMap<Req, Result<Res>>>
  ): void {}

  protected onDeleted(req: undefined): void {}

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {
    // Upon invalidation, undo the effects
    if (to === State.PENDING || to === State.DELETED) {
      this.lastSeen = null;
      this.notifier.cancel();
    }
  }

  async execField(ctx: ComputationMapFieldContext<Req>): Promise<Result<Res>> {
    this.inv();
    return this.mapDefinition.exec(ctx);
  }

  onFieldFinish(req: Req, result: Result<Res>): void {
    this.inv();
    this.resultsMap.set(req, result);
  }

  onFieldDeleted(req: Req): void {
    this.inv();
    this.resultsMap.delete(req);
  }

  onFieldStateChange(from: StateNotDeleted, to: StateNotCreating): void {
    this.inv();
    if (from !== State.CREATING) {
      this.status[from]--;
    }
    if (to !== State.DELETED) {
      this.status[to]++;
    }

    // React to changes
    if (this.lastSeen?.didChange()) {
      this.invalidate();
    }

    if (this.isDone()) {
      this.notifier.done(null);
    }
  }

  // TODO map and filter operations
}

/*class ComputationMap<Req, Res> {
  private readonly registry: ComputationRegistry;
  private readonly definition: ComputationMapDefinition<Req, Res>;
  private readonly entryDefinition: ComputationDefinition<
    ComputationMapStartContext<Req>,
    undefined,
    undefined
  >;
  private readonly computationsDefinition: ComputationDefinition<
    ComputationMapContext<Req>,
    Req,
    Res
  >;
  private readonly exitDefinition: ComputationDefinition<
    ComputationExitMapContext,
    undefined,
    ReadonlyHandlerHashMap<Req, Result<Res>>
  >;
  private readonly resultsMap: HashMap<Req, Result<Res>>;
  private readonly status: [number, number, number, number];
  private readonly notifier: Notifier<null>;
  private lastSeen: ReadonlyHandlerHashMap<Req, Result<Res>> | null;

  constructor(
    registry: ComputationRegistry,
    definition: ComputationMapDefinition<Req, Res>
  ) {
    this.registry = registry;
    this.definition = definition;
    this.entryDefinition = {
      exec: definition.entryExec,
      requestDef: anyValue,
      responseDef: anyValue,
      makeContext: ctx => ({
        get: ctx.get,
        compute: req => ctx.compute(this.make(req)),
      }),
    };
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
            this.status[to]++;
          }
          this.propagateChanges();
        },
        finished: (req, result) => {
          this.resultsMap.set(req, result);
        },
        deleted: req => {
          this.resultsMap.delete(req);
        },
      },
    };
    this.resultsMap = new HashMap<Req, Result<Res>>(this.definition.requestDef);
    this.status = [0, 0, 0, 0];
    this.notifier = createNotifier();
    this.lastSeen = null;
    this.exitDefinition = {
      exec: async ctx => {
        // Wait for the entry computation to finish
        await ctx.get(this.registry.make(this.entryDefinition, undefined));

        // Wait for all children computations to finish
        while (!this.isDone()) {
          // Ensure this running version is active before doing side-effects
          ctx.active();
          await this.notifier.wait();
          // In case invalidations occured between notifier.done()
          // and this computation resuming, keep waiting if !isDone()
        }

        return ok(this.resultsMap.getSnapshot());
      },
      requestDef: anyValue,
      responseDef: anyValue,
      makeContext: ctx => ctx,
      events: {
        stateChange: (c, from, to) => {
          // Upon invalidation, undo the effects
          if (to === State.PENDING || to === State.DELETED) {
            this.lastSeen = null;
            this.notifier.cancel();
          }
        },
        finished: (request, result) => {
          if (result.ok) {
            // Record the last seen version of the results map
            this.lastSeen = result.value;
          }
        },
        deleted(request) {},
      },
    };
  }

  private make(request: Req) {
    return this.registry.make(this.computationsDefinition, request);
  }

  private isDone() {
    return this.status[State.PENDING] + this.status[State.RUNNING] === 0;
  }

  private propagateChanges() {
    if (this.lastSeen?.didChange()) {
      this.getExitComputation().invalidate();
    }

    if (this.isDone()) {
      this.notifier.done(null);
    }
  }

  getExitComputation() {
    return this.registry.make(this.exitDefinition, undefined);
  }
}*/

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
      .computeIfAbsent(definition, d => new HashMap(d.requestDef))
      .computeIfAbsent(request, request =>
        definition.create(this, definition, request)
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
