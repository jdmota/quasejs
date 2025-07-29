import { assertion } from "../../../util/miscellaneous";
import {
  resultEqual,
  type VersionedComputationResult,
} from "../../utils/result";
import { type DependentComputation } from "./dependent";
import { type AnyRawComputation, RawComputation } from "../raw";

export interface SubscribableComputation<Res> {
  readonly subscribableMixin: SubscribableComputationMixin<Res>;
}

export class SubscribableComputationMixin<Res> {
  public readonly source: RawComputation<any, Res> &
    SubscribableComputation<Res>;
  private result: VersionedComputationResult<Res> | null;
  // Subscribers that subscribed, but are waiting for the result
  readonly pendingSubscribers: Set<AnyRawComputation & DependentComputation>;
  // Subscribers that subscribed, and have seen the result (and must be invalidated in case it changes)
  readonly lockedSubscribers: Set<AnyRawComputation & DependentComputation>;
  // Compare ok result's values
  private readonly equal: (a: Res, b: Res) => boolean;

  constructor(source: RawComputation<any, Res> & SubscribableComputation<Res>) {
    this.source = source;
    this.result = null;
    this.pendingSubscribers = new Set();
    this.lockedSubscribers = new Set();
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
    return (
      this.pendingSubscribers.size === 0 && this.lockedSubscribers.size === 0
    );
  }

  // We only invalidate when we get a new result
  // And only invalidate locked subscribers (those that have seen the previous result)
  // See DependentComputationMixin#getDep
  finishRoutine(
    result: VersionedComputationResult<Res>
  ): VersionedComputationResult<Res> {
    const old = this.result;
    if (old != null && resultEqual(this.equal, old.result, result.result)) {
      return old;
    }

    this.result = result;
    this.invalidateSubs(this.lockedSubscribers);
    assertion(this.lockedSubscribers.size === 0);
    return result;
  }

  invalidateRoutine() {}

  deleteRoutine() {
    this.result = null;
  }
}
