import {
  ComputationDescription,
  ComputationRegistry,
  Result,
} from "../incremental-lib";
import { RawComputation, RunId, State } from "./raw";

function transferSetItems<T>(from: Set<T>, to: Set<T>) {
  for (const e of from) {
    to.add(e);
  }
  from.clear();
}

export type AnyComputation = Computation<any, any, any>;

export abstract class Computation<Ctx, Req, Res> extends RawComputation<
  Ctx,
  Res
> {
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
