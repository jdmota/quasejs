import { AnyRawComputation, RawComputation, RunId } from "../../raw";
import { AnyStatefulComputation } from "../../stateful";
import { ObserverComputation } from "./observer";

export type EventFn<E> = (data: E, initial: boolean) => void;

export type EmitterContext<E> = {
  readonly emit: (data: E) => void;
};

export interface EmitterComputation<E> {
  readonly emitterMixin: EmitterComputationMixin<E>;

  getAllPastEvents(): IterableIterator<E>;
}

export class EmitterComputationMixin<E> {
  public readonly source: RawComputation<any, any> & EmitterComputation<E>;
  readonly observers: Map<
    AnyStatefulComputation & ObserverComputation,
    EventFn<E>
  >;

  constructor(source: RawComputation<any, any> & EmitterComputation<E>) {
    this.source = source;
    this.observers = new Map();
  }

  makeContextRoutine(): EmitterContext<E> {
    return {
      emit: data => this.emit(data),
    };
  }

  // It is not possible for observers to see emitted values from deleted computations
  // Because we can only delete the computation if we have zero observers
  // And we cannot add observers to a deleted computation
  // So it is fine to allow one to emit events even if the computation is not running
  emit(data: E) {
    this.source.inv();
    // Do not fire observers that were added during this routine
    const observers = Array.from(this.observers.values());
    for (const fn of observers) {
      fn(data, false);
    }
  }

  emitInitialFor(observer: AnyStatefulComputation & ObserverComputation) {
    const fn = this.observers.get(observer);
    if (fn) {
      for (const item of this.source.getAllPastEvents()) {
        fn(item, true);
      }
    }
  }

  isOrphan(): boolean {
    return this.observers.size === 0;
  }

  deleteRoutine(): void {
    if (!this.isOrphan()) {
      throw new Error(
        "Invariant violation: Cannot delete computation with observers"
      );
    }
  }

  inNodesRoutine(): IterableIterator<AnyRawComputation> {
    return this.observers.keys();
  }
}
