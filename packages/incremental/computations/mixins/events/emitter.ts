import { LinkedList } from "../../../utils/linked-list";
import { AnyRawComputation, RawComputation, RunId } from "../../raw";
import { AnyStatefulComputation } from "../../stateful";
import { ObserverComputation } from "./observer";

export type EventFn<E> = (data: E, initial: boolean) => void;

export type EmitterContext<E> = {
  readonly emit: (data: E) => void;
};

export interface EmitterComputation<E> {
  readonly emitterMixin: EmitterComputationMixin<E>;
}

export class EmitterComputationMixin<E> {
  public readonly source: RawComputation<any, any> & EmitterComputation<E>;
  readonly observers: Map<
    AnyStatefulComputation & ObserverComputation,
    EventFn<E>
  >;
  readonly history: LinkedList<E>;

  constructor(source: RawComputation<any, any> & EmitterComputation<E>) {
    this.source = source;
    this.observers = new Map();
    this.history = new LinkedList();
  }

  makeContextRoutine(runId: RunId): EmitterContext<E> {
    return {
      emit: data => this.emit(data, runId),
    };
  }

  private emit(data: E, runId: RunId) {
    this.source.checkActive(runId);
    this.history.addLast(data);
    // Do not fire observers that were added during this routine
    const observers = Array.from(this.observers.values());
    for (const fn of observers) {
      fn(data, false);
    }
  }

  emitInitialFor(observer: AnyStatefulComputation & ObserverComputation) {
    const fn = this.observers.get(observer);
    if (fn) {
      for (const item of this.history) {
        fn(item, true);
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
