import { ComputationDescription } from "../../incremental-lib";
import { Result } from "../../utils/result";
import { setAdd } from "../../utils/set";
import { AnyRawComputation, RawComputation, RunId } from "../raw";
import { SubscribableComputation } from "./subscribable";

export type DependentContext = {
  readonly get: <T>(
    description: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<Result<T>>;
};

export interface DependentComputation {
  readonly dependentMixin: DependentComputationMixin;
}

export class DependentComputationMixin {
  public readonly source: AnyRawComputation & DependentComputation;
  // Dependencies
  private readonly dependencies: Set<
    AnyRawComputation & SubscribableComputation<any>
  >;

  constructor(source: AnyRawComputation & DependentComputation) {
    this.source = source;
    this.dependencies = new Set();
  }

  makeContextRoutine(runId: RunId): DependentContext {
    return {
      get: dep => this.getDep(dep, runId),
    };
  }

  private subscribe(dep: AnyRawComputation & SubscribableComputation<any>) {
    dep.inv();
    if (setAdd(this.dependencies, dep)) {
      dep.subscribableMixin.subscribers.add(this.source);
      dep.onInEdgeAddition(this.source);
    }
    return dep;
  }

  private unsubscribe(dep: AnyRawComputation & SubscribableComputation<any>) {
    if (this.dependencies.delete(dep)) {
      dep.subscribableMixin.subscribers.delete(this.source);
      dep.subscribableMixin.oldSubscribers.delete(this.source);
      dep.onInEdgeRemoval(this.source);
    }
  }

  private getDep<T>(
    description: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >,
    runId: RunId
  ): Promise<Result<T>> {
    this.source.checkActive(runId);
    return this.subscribe(this.source.registry.make(description)).run();
  }

  private disconnect() {
    // Disconnect from dependencies.
    // The connection might be restored after rerunning this computation.
    // This is fine because our garbage collection of computations
    // only occurs after everything is stable.
    for (const dep of this.dependencies) {
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
    return this.dependencies.values();
  }
}
