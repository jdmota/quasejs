import { setAdd } from "../../../util/maps-sets";
import { RunId } from "../../utils/run-id";
import { AnyRawComputation, RawComputation } from "../raw";
import { ComputationDescription } from "../description";
import { EmitterComputation, EventFn } from "./emitter";
import { EmitterDoneComputation } from "./emitter-done";

export type ObserverContext = {
  readonly listen: <K, V, R>(
    description: ComputationDescription<
      RawComputation<any, any> &
        (EmitterComputation<K, V, R> | EmitterDoneComputation<R>)
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
    AnyRawComputation &
      (EmitterComputation<any, any, any> | EmitterDoneComputation<any>)
  >;
  private observerInitId: RunId;

  constructor(source: RawComputation<any, any> & ObserverComputation) {
    this.source = source;
    this.emitters = new Set();
    this.observerInitId = new RunId();
  }

  newObserverInitId() {
    return this.observerInitId.newId();
  }

  finishObserverInit() {
    this.observerInitId.cancel();
  }

  checkInitActive(observerInitId: number) {
    if (this.observerInitId.isNotActive(observerInitId)) {
      throw new Error("Cannot listen in this state");
    }
  }

  makeContextRoutine(runId: number, observerInitId: number): ObserverContext {
    return {
      listen: (desc, fn) => this.listen(runId, observerInitId, desc, fn),
    };
  }

  private listen<K, V, R>(
    runId: number,
    observerInitId: number,
    description: ComputationDescription<
      RawComputation<any, any> &
        (EmitterComputation<K, V, R> | EmitterDoneComputation<R>)
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

  askForInitial(runId: number) {
    this.source.checkActive(runId);
    for (const emitter of this.emitters) {
      emitter.emitterMixin.emitInitialFor(this.source);
    }
    // Ensure progress
    this.source.registry.scheduleWake();
  }

  private unsubscribe(
    dep: AnyRawComputation &
      (EmitterComputation<any, any, any> | EmitterDoneComputation<any>)
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
