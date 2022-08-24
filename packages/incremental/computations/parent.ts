import { ChildComputation } from "./child";
import { AnyRawComputation, RunId } from "./raw";

export interface ParentComputation {
  readonly parentMixin: ParentComputationMixin;
}

export class ParentComputationMixin {
  public readonly source: AnyRawComputation & ParentComputation;
  private readonly children: Set<AnyRawComputation & ChildComputation>;

  constructor(source: AnyRawComputation & ParentComputation) {
    this.source = source;
    this.children = new Set();
  }

  private own(child: AnyRawComputation & ChildComputation) {
    this.children.add(child);
    child.childMixin.parents.add(this.source);
    child.onInEdgeAddition(this.source);
  }

  private unown(child: AnyRawComputation & ChildComputation) {
    this.children.delete(child);
    child.childMixin.parents.delete(this.source);
    child.onInEdgeRemoval(this.source);
  }

  compute(child: AnyRawComputation & ChildComputation, runId: RunId) {
    child.inv();
    this.source.active(runId);
    this.own(child);
  }

  private disconnect() {
    // Disconnect from owned computations.
    // The connection might be restored after rerunning this computation.
    // This is fine because our garbage collection of computations
    // only occurs after everything is stable.
    for (const owned of this.children) {
      this.unown(owned);
    }
  }

  invalidateRoutine(): void {
    this.disconnect();
  }

  deleteRoutine(): void {
    this.disconnect();
  }

  outNodesRoutine(): IterableIterator<AnyRawComputation> {
    return this.children.values();
  }
}