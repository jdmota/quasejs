import { setAdd } from "../../../../util/maps-sets";
import { ComputationDescription } from "../../../incremental-lib";
import { AnyRawComputation, RawComputation, RunId } from "../../raw";
import { EmitterComputation, EventFn } from "./emitter";

export type ObserverContext = {
  readonly listen: <K, V, R>(
    description: ComputationDescription<
      RawComputation<any, any> & EmitterComputation<K, V, R>
    >,
    fn: EventFn<K, V, R>
  ) => void;
};

export interface ObserverComputation {
  readonly observerMixin: ObserverComputationMixin;
}

export class ObserverComputationMixin {
  public readonly source: RawComputation<any, any> & ObserverComputation;
  public readonly emitters: Set<
    AnyRawComputation & EmitterComputation<any, any, any>
  >;
  private observerInitId: number;

  constructor(source: RawComputation<any, any> & ObserverComputation) {
    this.source = source;
    this.emitters = new Set();
    this.observerInitId = 0;
  }

  newObserverInitId() {
    this.observerInitId = Math.abs(this.observerInitId) + 1;
    return this.observerInitId;
  }

  finishObserverInit() {
    this.observerInitId = -this.observerInitId;
  }

  checkInitActive(observerInitId: number) {
    if (observerInitId !== this.observerInitId) {
      throw new Error("Cannot listen in this state");
    }
  }

  makeContextRoutine(runId: RunId, observerInitId: number): ObserverContext {
    return {
      listen: (desc, fn) => this.listen(runId, observerInitId, desc, fn),
    };
  }

  private listen<K, V, R>(
    runId: RunId,
    observerInitId: number,
    description: ComputationDescription<
      RawComputation<any, any> & EmitterComputation<K, V, R>
    >,
    fn: EventFn<K, V, R>
  ) {
    this.source.checkActive(runId);
    this.checkInitActive(observerInitId);

    const dep = this.source.registry.make(description);
    dep.inv();

    if (setAdd(this.emitters, dep)) {
      dep.emitterMixin.observers.set(this.source, fn);
    } else {
      throw new Error("Cannot listen twice");
    }
  }

  askForInitial(runId: RunId) {
    this.source.checkActive(runId);
    for (const emitter of this.emitters) {
      emitter.emitterMixin.emitInitialFor(this.source);
    }
    // Ensure progress
    this.source.registry.scheduleWake();
  }

  private unsubscribe(
    dep: AnyRawComputation & EmitterComputation<any, any, any>
  ) {
    if (this.emitters.delete(dep)) {
      dep.emitterMixin.observers.delete(this.source);
    }
  }

  private disconnect() {
    // Disconnect from emitters.
    // The connection might be restored after rerunning this computation.
    // This is fine because our garbage collection of computations
    // only occurs after everything is stable.
    for (const dep of this.emitters.keys()) {
      this.unsubscribe(dep);
    }
  }

  resetRoutine() {
    this.finishObserverInit();
    this.disconnect();
  }
}
