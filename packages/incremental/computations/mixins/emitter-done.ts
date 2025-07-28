import {
  ComputationResult,
  VersionedComputationResult,
} from "../../utils/result";
import { RawComputation } from "../raw";
import { ObserverComputation } from "./observer";

export type EmitterDoneEvent<R> = Readonly<{
  type: "done";
  result: ComputationResult<R>;
}>;

export type EventDoneFn<R> = (event: EmitterDoneEvent<R>) => void;

export interface EmitterDoneComputation<R> {
  readonly emitterMixin: EmitterDoneComputationMixin<R>;
}

export class EmitterDoneComputationMixin<R> {
  public readonly source: RawComputation<any, any> & EmitterDoneComputation<R>;
  public readonly observers: Map<
    RawComputation<any, any> & ObserverComputation,
    EventDoneFn<R>
  >;
  private result: VersionedComputationResult<R> | null;

  constructor(source: RawComputation<any, any> & EmitterDoneComputation<R>) {
    this.source = source;
    this.observers = new Map();
    this.result = null;
  }

  emitInitialFor(observer: RawComputation<any, any> & ObserverComputation) {
    const fn = this.observers.get(observer);
    if (fn) {
      // No need to use registry.callUserFn here since this method
      // is called inside the "exec" of the observer
      if (this.result != null) {
        fn({
          type: "done",
          result: this.result.result,
        });
      }
    }
  }

  isOrphan(): boolean {
    return this.observers.size === 0;
  }

  finishRoutine(
    result: VersionedComputationResult<R>
  ): VersionedComputationResult<R> {
    if (this.result !== result) {
      const registry = this.source.registry;
      this.result = result;
      for (const [observer, fn] of this.observers) {
        registry.callUserFn(observer.description, fn, {
          type: "done",
          result: result.result,
        });
      }
    }
    return result;
  }

  invalidateRoutine() {}

  deleteRoutine() {
    this.result = null;
  }
}
