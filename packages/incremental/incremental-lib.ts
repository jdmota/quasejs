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

export type ComputationDescription<C extends AnyRawComputation> = {
  readonly create: (registry: ComputationRegistry) => C;
  readonly equal: <O extends AnyRawComputation>(
    other: ComputationDescription<O>
  ) => boolean;
  readonly hash: () => number;
};

type AnyRawComputation = RawComputation<any, any>;

abstract class RawComputation<Ctx, Res> {
  public readonly registry: ComputationRegistry;
  public readonly description: ComputationDescription<any>;
  // Current state
  private state: State;
  private runId: RunId | null;
  private running: Promise<Result<Res>> | null;
  // Latest result
  protected result: Result<Res> | null;
  // Requirements of SpecialQueue
  public prev: AnyComputation | null;
  public next: AnyComputation | null;

  constructor(
    registry: ComputationRegistry,
    description: ComputationDescription<any>,
    mark: boolean = true
  ) {
    this.registry = registry;
    this.description = description;
    this.state = State.CREATING;
    this.runId = null;
    this.running = null;
    this.result = null;
    this.prev = null;
    this.next = null;
    if (mark) this.mark(State.PENDING);
  }

  peekError() {
    if (this.result?.ok === false) {
      return this.result.error;
    }
    throw new Error("Assertion error: no error");
  }

  protected abstract exec(ctx: Ctx): Promise<Result<Res>>;
  protected abstract makeContext(runId: RunId): Ctx;
  protected abstract isOrphan(): boolean;

  protected inv() {
    if (this.state === State.DELETED) {
      throw new Error("Unexpected deleted computation");
    }
  }

  protected active(runId: RunId) {
    if (runId !== this.runId) {
      throw new Error("Computation was cancelled");
    }
  }

  protected onFinish(result: Result<Res>) {
    this.result = result;
  }

  private after(result: Result<Res>, runId: RunId): Result<Res> {
    if (this.runId === runId) {
      this.onFinish(result);
      this.mark(result.ok ? State.DONE : State.ERRORED);
    }
    return result;
  }

  protected async run(): Promise<Result<Res>> {
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

  protected onInvalidate() {
    this.runId = null;
    this.running = null;
    this.result = null;
  }

  invalidate() {
    this.inv();
    this.onInvalidate();
    this.mark(State.PENDING);
  }

  protected onDeleted() {
    this.runId = null;
    this.running = null;
    this.result = null;
  }

  // pre: this.isOrphan()
  destroy() {
    this.inv();
    this.onDeleted();
    this.mark(State.DELETED);
  }

  protected abstract onStateChange(
    from: StateNotDeleted,
    to: StateNotCreating
  ): void;

  protected mark(state: StateNotCreating) {
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

  maybeRun() {
    if (this.isOrphan()) {
      // this.destroy();
    } else {
      this.run();
    }
  }
}

type AnyComputation = Computation<any, any, any>;

abstract class Computation<Ctx, Req, Res> extends RawComputation<Ctx, Res> {
  public readonly request: Req;
  // Dependencies
  private readonly dependencies: Set<AnyComputation>;
  // Subscribers that saw the latest result
  private readonly subscribers: Set<AnyComputation>;
  // If not null, it means all oldSubscribers saw this value
  // It is important to keep oldResult separate from result
  // See invalidate()
  private oldResult: Result<Res> | null;
  private readonly oldSubscribers: Set<AnyComputation>;

  constructor(
    registry: ComputationRegistry,
    description: ComputationDescription<any>,
    request: Req,
    mark: boolean = true
  ) {
    super(registry, description, false);
    this.request = request;
    this.dependencies = new Set();
    this.subscribers = new Set();
    this.oldResult = null;
    this.oldSubscribers = new Set();
    if (mark) this.mark(State.PENDING);
  }

  protected abstract responseEqual(a: Res, b: Res): boolean;

  private equals(prev: Result<Res>, next: Result<Res>): boolean {
    if (prev.ok) {
      return next.ok && this.responseEqual(prev.value, next.value);
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

  protected onFinishNew(result: Result<Res>) {}

  protected override onFinish(result: Result<Res>): void {
    super.onFinish(result);

    const old = this.oldResult;
    this.oldResult = null;

    if (old != null && this.equals(old, result)) {
      transferSetItems(this.oldSubscribers, this.subscribers);
    } else {
      this.invalidateSubs(this.oldSubscribers);
      this.onFinishNew(result);
    }
  }

  protected getDep<T>(
    dep: Computation<any, any, T>,
    runId: RunId
  ): Promise<Result<T>> {
    this.active(runId);
    this.subscribe(dep);
    return dep.run();
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

  protected override onInvalidate(): void {
    const { result } = this;
    // Invalidate run
    super.onInvalidate();
    // If a computation is invalidated, partially executed, and then invalidated again,
    // oldResult will be null.
    // This will cause computations that subcribed in between both invalidations
    // to be propertly invalidated, preserving the invariant
    // that all oldSubscribers should have seen the same oldResult, if not null.
    this.oldResult = result;
    // Delay invalidation of subscribers
    // by moving them to the list of oldSubscribers.
    transferSetItems(this.subscribers, this.oldSubscribers);
    // Disconnect from dependencies and children computations.
    // The connection might be restored after rerunning this computation.
    // This is fine because our garbage collection of computations
    // only occurs after everything is stable.
    this.disconnect();
  }

  protected override onDeleted(): void {
    super.onDeleted();
    this.oldResult = null;
    this.disconnect();
    this.invalidateSubs(this.subscribers);
    this.invalidateSubs(this.oldSubscribers);
  }

  protected isOrphan(): boolean {
    return this.subscribers.size === 0 && this.oldSubscribers.size === 0;
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

  protected override disconnect() {
    super.disconnect();

    for (const owned of this.owned) {
      this.unown(owned);
    }
  }

  protected override isOrphan(): boolean {
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

type ComputationExec<Ctx, Res> = (ctx: Ctx) => Promise<Result<Res>>;

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
    description: ComputationDescription<any>,
    request: Req,
    source: ComputationMap<Req, Res>
  ) {
    super(registry, description, request, false);
    this.source = source;
    this.mark(State.PENDING);
  }

  override subscribe(dep: AnyComputation): void {
    // TODO split two kinds of computations
    throw new Error("Cannot subscribe to this kind of computation");
  }

  protected override responseEqual(a: Res, b: Res): boolean {
    return this.source.mapDefinition.responseDef.equal(a, b);
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

  protected override onFinishNew(result: Result<Res>): void {
    super.onFinishNew(result);
    this.source.onFieldFinishNew(this.request, result);
  }

  protected override onDeleted(): void {
    super.onDeleted();
    this.source.onFieldDeleted(this.request);
  }

  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {
    this.source.onFieldStateChange(from, to);
  }
}

class ComputationMapFieldDescription<Req, Res>
  implements ComputationDescription<ComputationMapField<Req, Res>>
{
  private readonly request: Req;
  private readonly source: ComputationMap<Req, Res>;

  constructor(request: Req, source: ComputationMap<Req, Res>) {
    this.request = request;
    this.source = source;
  }

  create(registry: ComputationRegistry): ComputationMapField<Req, Res> {
    return new ComputationMapField(registry, this, this.request, this.source);
  }

  equal<O extends AnyRawComputation>(other: ComputationDescription<O>) {
    return (
      other instanceof ComputationMapFieldDescription &&
      this.source === other.source &&
      this.source.mapDefinition.requestDef.equal(this.request, other.request)
    );
  }

  hash() {
    return this.source.mapDefinition.requestDef.hash(this.request);
  }
}

class ComputationMap<Req, Res> extends ComputationWithChildren<
  ComputationMapContext<Req>,
  undefined,
  ReadonlyHandlerHashMap<Req, Result<Res>>
> {
  public readonly mapDefinition: ComputationMapDefinition<Req, Res>;
  private readonly resultsMap: HashMap<Req, Result<Res>>;
  private readonly status: [number, number, number, number];
  private readonly notifier: Notifier<null>;
  private lastSeen: ReadonlyHandlerHashMap<Req, Result<Res>> | null;

  constructor(
    registry: ComputationRegistry,
    description: ComputationDescription<any>,
    mapDefinition: ComputationMapDefinition<Req, Res>
  ) {
    super(registry, description, undefined, false);
    this.mapDefinition = mapDefinition;
    this.resultsMap = new HashMap<Req, Result<Res>>(mapDefinition.requestDef);
    this.status = [0, 0, 0, 0];
    this.notifier = createNotifier();
    this.lastSeen = null;
    this.mark(State.PENDING);
  }

  protected override responseEqual(
    a: ReadonlyHandlerHashMap<Req, Result<Res>>,
    b: ReadonlyHandlerHashMap<Req, Result<Res>>
  ): boolean {
    return false;
  }

  make(request: Req): AnyComputationWithChildren {
    return this.registry.make(
      new ComputationMapFieldDescription(request, this)
    );
  }

  private isDone() {
    // TODO FIXME cannot rely on this! deletion happens later. how do we know the pending ones are not orphan?
    // In fact, since this will produce a graph (maybe a cyclic one)
    // How to know if some computation should still exist??
    return this.status[State.PENDING] + this.status[State.RUNNING] === 0;
  }

  protected async exec(
    ctx: ComputationMapContext<Req>
  ): Promise<Result<ReadonlyHandlerHashMap<Req, Result<Res>>>> {
    const { startExec } = this.mapDefinition;

    // Wait for the start computation to finish
    const startResult = await startExec({
      get: ctx.get,
      compute: ctx.compute,
    });

    if (!startResult.ok) {
      return startResult;
    }

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

  onFieldFinishNew(req: Req, result: Result<Res>): void {
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
