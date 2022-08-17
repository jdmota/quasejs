import { Result } from "../utils/result";
import { RawComputation, RunId } from "./raw";
import { SubscribableComputation } from "./subscribable";

export interface DependentComputation {
  readonly dependentMixin: DependentComputationMixin;

  invalidate(): void;
}

export class DependentComputationMixin {
  public readonly source: RawComputation<any, any> & DependentComputation;
  // Dependencies
  private readonly dependencies: Set<SubscribableComputation<any>>;

  constructor(source: RawComputation<any, any> & DependentComputation) {
    this.source = source;
    this.dependencies = new Set();
  }

  private subscribe(dep: SubscribableComputation<any>) {
    this.dependencies.add(dep);
    dep.subscribableMixin.subscribers.add(this.source);
  }

  private unsubscribe(dep: SubscribableComputation<any>) {
    this.dependencies.delete(dep);
    dep.subscribableMixin.subscribers.delete(this.source);
    dep.subscribableMixin.oldSubscribers.delete(this.source);
  }

  getDep<T>(dep: SubscribableComputation<T>, runId: RunId): Promise<Result<T>> {
    dep.inv();
    this.source.active(runId);
    this.subscribe(dep);
    return dep.run();
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
}
