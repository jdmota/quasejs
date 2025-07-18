import { setAdd } from "../../../util/maps-sets";
import { ComputationDescription } from "../../incremental-lib";
import {
  ComputationResult,
  promiseIfOk,
  VersionedComputationResult,
} from "../../utils/result";
import { AnyRawComputation, RawComputation, RunId } from "../raw";
import { SubscribableComputation } from "./subscribable";

export type DependentContext = {
  readonly get: <T>(
    description: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<ComputationResult<T>>;
  readonly getOk: <T>(
    description: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<T>;
};

export interface DependentComputation {
  readonly dependentMixin: DependentComputationMixin;
}

export interface MaybeDependentComputation {
  readonly dependentMixin?: DependentComputationMixin;
}

export type GetCall = {
  readonly kind: "get";
  readonly computation: AnyRawComputation;
  readonly version: number;
};

export class DependentComputationMixin {
  public readonly source: AnyRawComputation & DependentComputation;
  // Dependencies
  private readonly dependencies: Set<
    AnyRawComputation & SubscribableComputation<any>
  >;
  // We don't know if by any chance we requested the same dependency twice
  // and got different values (because subscribers invalidation is delayed - see SubscribableComputationMixin),
  // so we keep an array instead of a map (important for CacheableMixin)
  private getCallsAmount: number;
  private getCalls: GetCall[];

  constructor(source: AnyRawComputation & DependentComputation) {
    this.source = source;
    this.dependencies = new Set();
    this.getCallsAmount = 0;
    this.getCalls = [];
  }

  getAllGetCalls(): null | readonly GetCall[] {
    return this.getCallsAmount === this.getCalls.length ? this.getCalls : null;
  }

  makeContextRoutine(runId: RunId): DependentContext {
    return {
      get: dep => this.getDep(dep, runId).then(r => r.result),
      getOk: dep => promiseIfOk(this.getDep(dep, runId).then(r => r.result)),
    };
  }

  private subscribe(dep: AnyRawComputation & SubscribableComputation<any>) {
    dep.inv();
    if (setAdd(this.dependencies, dep)) {
      dep.subscribableMixin.subscribers.add(this.source);
    }
    return dep;
  }

  private unsubscribe(dep: AnyRawComputation & SubscribableComputation<any>) {
    if (this.dependencies.delete(dep)) {
      dep.subscribableMixin.subscribers.delete(this.source);
      dep.subscribableMixin.oldSubscribers.delete(this.source);
    }
  }

  async getDep<T>(
    description: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >,
    runId: RunId
  ): Promise<VersionedComputationResult<T>> {
    this.source.checkActive(runId);
    this.getCallsAmount++;
    const computation = this.source.registry.make(description);
    const result = await this.subscribe(computation).run();
    this.source.checkActive(runId);
    this.getCalls.push({
      kind: "get",
      computation,
      version: result.version,
    });
    return result;
  }

  private disconnect() {
    // Disconnect from dependencies.
    // The connection might be restored after rerunning this computation.
    // This is fine because our garbage collection of computations
    // only occurs after everything is stable.
    for (const dep of this.dependencies) {
      this.unsubscribe(dep);
    }
    // Reset registry of "get" calls
    this.getCallsAmount = 0;
    this.getCalls = [];
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
