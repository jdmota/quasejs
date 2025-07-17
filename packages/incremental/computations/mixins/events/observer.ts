import { setAdd } from "../../../../util/maps-sets";
import { ComputationDescription } from "../../../incremental-lib";
import { AnyRawComputation, RawComputation, RunId } from "../../raw";
import { AnyStatefulComputation } from "../../stateful";
import { EmitterComputation, EventFn } from "./emitter";

export type ObserverContext = {
  readonly addListener: <E>(
    description: ComputationDescription<
      RawComputation<any, any> & EmitterComputation<E>
    >,
    fn: EventFn<E>
  ) => void;
  readonly removeListener: <E>(
    description: ComputationDescription<
      RawComputation<any, any> & EmitterComputation<E>
    >
  ) => void;
  readonly askForInitial: <E>(
    description: ComputationDescription<
      RawComputation<any, any> & EmitterComputation<E>
    >
  ) => void;
};

export interface ObserverComputation {
  readonly observerMixin: ObserverComputationMixin;
}

export class ObserverComputationMixin {
  public readonly source: AnyStatefulComputation & ObserverComputation;
  private readonly emitters: Set<AnyRawComputation & EmitterComputation<any>>;

  constructor(source: AnyStatefulComputation & ObserverComputation) {
    this.source = source;
    this.emitters = new Set();
  }

  makeContextRoutine(runId: RunId): ObserverContext {
    return {
      addListener: (desc, fn) => this.addListener(desc, fn, runId),
      removeListener: desc => this.removeListener(desc, runId),
      askForInitial: desc => this.askForInitial(desc, runId),
    };
  }

  private subscribe<E>(
    dep: AnyRawComputation & EmitterComputation<E>,
    fn: EventFn<E>
  ) {
    dep.inv();
    dep.emitterMixin.observers.set(this.source, fn);

    if (setAdd(this.emitters, dep)) {
      // dep.onInEdgeAddition(this.source);
    }
  }

  private unsubscribe(dep: AnyRawComputation & EmitterComputation<any>) {
    if (this.emitters.delete(dep)) {
      dep.emitterMixin.observers.delete(this.source);
      // dep.onInEdgeRemoval(this.source);
    }
  }

  private addListener<E>(
    description: ComputationDescription<
      RawComputation<any, any> & EmitterComputation<E>
    >,
    fn: EventFn<E>,
    runId: RunId
  ) {
    this.source.checkActive(runId);
    this.subscribe(this.source.registry.make(description), fn);
    // Ensure progress
    this.source.registry.scheduleWake();
  }

  private removeListener<E>(
    description: ComputationDescription<
      RawComputation<any, any> & EmitterComputation<E>
    >,
    runId: RunId
  ) {
    this.source.checkActive(runId);
    this.unsubscribe(this.source.registry.make(description));
  }

  private askForInitial<E>(
    description: ComputationDescription<
      RawComputation<any, any> & EmitterComputation<E>
    >,
    runId: RunId
  ) {
    this.source.checkActive(runId);
    this.source.registry
      .make(description)
      .emitterMixin.emitInitialFor(this.source);
  }

  private disconnect() {
    // Disconnect from emitters.
    // The connection might be restored after rerunning this computation.
    // This is fine because our garbage collection of computations
    // only occurs after everything is stable.
    for (const dep of this.emitters) {
      this.unsubscribe(dep);
    }
  }

  invalidateRoutine(): void {
    this.disconnect();
  }

  deleteRoutine(): void {
    this.disconnect();
  }

  outNodesRoutine(): IterableIterator<AnyRawComputation> {
    return this.emitters.values();
  }
}
