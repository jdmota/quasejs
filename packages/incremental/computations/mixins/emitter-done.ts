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
  public readonly observers: Map<ObserverComputation, EventDoneFn<R>>;
  private result: VersionedComputationResult<R> | null;

  constructor(source: RawComputation<any, any> & EmitterDoneComputation<R>) {
    this.source = source;
    this.observers = new Map();
    this.result = null;
  }

  emitInitialFor(observer: RawComputation<any, any> & ObserverComputation) {
    const fn = this.observers.get(observer);
    if (fn) {
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
      this.result = result;
      for (const fn of this.observers.values()) {
        // TODO next tick?
        fn({
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
