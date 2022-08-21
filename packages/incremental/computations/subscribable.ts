import { joinIterators } from "../utils/join-iterators";
import { Result, resultEqual } from "../utils/result";
import { DependentComputation } from "./dependent";
import { AnyRawComputation, RawComputation } from "./raw";

export interface SubscribableComputation<Res> {
  readonly subscribableMixin: SubscribableComputationMixin<Res>;
  responseEqual(a: Res, b: Res): boolean;
  onNewResult(result: Result<Res>): void;
}

function transferSetItems<T>(from: Set<T>, to: Set<T>) {
  for (const e of from) {
    to.add(e);
  }
  from.clear();
}

export class SubscribableComputationMixin<Res> {
  public readonly source: RawComputation<any, Res> &
    SubscribableComputation<Res>;
  // Subscribers that saw the latest result
  private result: Result<Res> | null;
  readonly subscribers: Set<AnyRawComputation & DependentComputation>;
  // If not null, it means all oldSubscribers saw this value
  // It is important to keep oldResult separate from result
  // See invalidate()
  private oldResult: Result<Res> | null;
  readonly oldSubscribers: Set<AnyRawComputation & DependentComputation>;
  // Compare ok result's values
  private readonly equal: (a: Res, b: Res) => boolean;

  constructor(source: RawComputation<any, Res> & SubscribableComputation<Res>) {
    this.source = source;
    this.result = null;
    this.subscribers = new Set();
    this.oldResult = null;
    this.oldSubscribers = new Set();
    this.equal = (a, b) => this.source.responseEqual(a, b);
  }

  private invalidateSubs(
    subs: ReadonlySet<AnyRawComputation & DependentComputation>
  ) {
    for (const sub of subs) {
      sub.invalidate();
    }
  }

  isOrphan(): boolean {
    return this.subscribers.size === 0 && this.oldSubscribers.size === 0;
  }

  finishRoutine(result: Result<Res>): void {
    const old = this.oldResult;
    this.oldResult = null;
    this.result = result;

    if (old != null && resultEqual(this.equal, old, result)) {
      transferSetItems(this.oldSubscribers, this.subscribers);
    } else {
      this.invalidateSubs(this.oldSubscribers);
      this.source.onNewResult(result);
    }
  }

  invalidateRoutine(): void {
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
  }

  // pre: this.subscribers.size === 0 && this.oldSubscribers.size === 0
  deleteRoutine(): void {
    this.oldResult = null;
    this.result = null;
  }

  inEdgesRoutine(): IterableIterator<AnyRawComputation> {
    return joinIterators(
      this.oldSubscribers.values(),
      this.subscribers.values()
    );
  }
}
