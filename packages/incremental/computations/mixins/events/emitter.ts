import { LinkedList } from "../../../utils/linked-list";
import { AnyRawComputation, RawComputation } from "../../raw";
import { AnyStatefulComputation } from "../../stateful";
import { ObserverComputation } from "./observer";

export type Events = {
  readonly [key in string]: unknown;
};

export type EventFn<E extends Events> = <K extends keyof E>(
  event: K,
  value: E[K],
  initial: boolean
) => void;

export interface EmitterComputation<E extends Events> {
  readonly emitterMixin: EmitterComputationMixin<E>;
}

type PastEvent<E extends Events, K extends keyof E> = {
  readonly event: K;
  readonly value: E[K];
};

export class EmitterComputationMixin<E extends Events> {
  public readonly source: RawComputation<any, any> & EmitterComputation<E>;
  readonly observers: Map<
    AnyStatefulComputation & ObserverComputation,
    EventFn<E>
  >;
  readonly history: LinkedList<PastEvent<E, keyof E>>;

  constructor(source: RawComputation<any, any> & EmitterComputation<E>) {
    this.source = source;
    this.observers = new Map();
    this.history = new LinkedList();
  }

  emitRoutine<K extends keyof E>(event: K, value: E[K]) {
    this.history.addLast({
      event,
      value,
    });
    // Do not fire observers that were added during this routine
    const observers = Array.from(this.observers.values());
    for (const fn of observers) {
      fn(event, value, false);
    }
  }

  emitInitialFor(observer: AnyStatefulComputation & ObserverComputation) {
    const fn = this.observers.get(observer);
    if (fn) {
      for (const item of this.history) {
        fn(item.event, item.value, true);
      }
    }
  }

  isOrphan(): boolean {
    return this.observers.size === 0;
  }

  deleteRoutine(): void {
    if (!this.isOrphan()) {
      throw new Error("Cannot delete computation with observers");
    }
  }

  inNodesRoutine(): IterableIterator<AnyRawComputation> {
    return this.observers.keys();
  }
}
