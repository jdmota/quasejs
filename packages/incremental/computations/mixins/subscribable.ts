import { joinIterators } from "../../../util/join-iterators";
import { resultEqual, VersionedComputationResult } from "../../utils/result";
import { DependentComputation } from "./dependent";
import { AnyRawComputation, RawComputation } from "../raw";

export interface SubscribableComputation<Res> {
  readonly subscribableMixin: SubscribableComputationMixin<Res>;
  onNewResult(result: VersionedComputationResult<Res>): void;
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
  private result: VersionedComputationResult<Res> | null;
  readonly subscribers: Set<AnyRawComputation & DependentComputation>;
  // If not "oldResult" is not null, it means all oldSubscribers saw this value
  // It is important to keep oldResult separate from result
  // See invalidate()
  private oldResult: VersionedComputationResult<Res> | null;
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

  finishRoutine(
    result: VersionedComputationResult<Res>
  ): VersionedComputationResult<Res> {
    const old = this.oldResult;
    this.oldResult = null;

    if (old != null && resultEqual(this.equal, old.result, result.result)) {
      // If the result is the same as before, preserve the old version
      this.result = old;
      transferSetItems(this.oldSubscribers, this.subscribers);
      return old;
    }

    this.result = result;
    this.invalidateSubs(this.oldSubscribers);
    this.source.onNewResult(result);
    return result;
  }

  invalidateRoutine(): void {
    // If a computation is invalidated, partially executed, and then invalidated again,
    // oldResult will be null.
    // This will cause computations that subscribed in between both invalidations
    // to be properly invalidated, preserving the invariant
    // that all oldSubscribers should have seen the same oldResult, if not null.
    this.oldResult = this.result;
    this.result = null;
    // Delay invalidation of subscribers
    // by moving them to the list of oldSubscribers.
    transferSetItems(this.subscribers, this.oldSubscribers);
  }

  deleteRoutine(): void {
    if (!this.isOrphan()) {
      throw new Error(
        "Invariant violation: Cannot delete computation with subscribers"
      );
    }
    this.oldResult = null;
    this.result = null;
  }

  inNodesRoutine(): IterableIterator<AnyRawComputation> {
    return joinIterators(
      this.oldSubscribers.values(),
      this.subscribers.values()
    );
  }
}
