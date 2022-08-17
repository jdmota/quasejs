import { ChildComputation } from "./child";
import { RawComputation, RunId } from "./raw";

export interface ParentComputation {
  readonly parentMixin: ParentComputationMixin;
}

export class ParentComputationMixin {
  public readonly source: RawComputation<any, any> & ParentComputation;
  private readonly children: Set<ChildComputation>;

  constructor(source: RawComputation<any, any> & ParentComputation) {
    this.source = source;
    this.children = new Set();
  }

  private own(child: ChildComputation) {
    this.children.add(child);
    child.childrenMixin.parents.add(this.source);
  }

  private unown(child: ChildComputation) {
    this.children.delete(child);
    child.childrenMixin.parents.delete(this.source);
  }

  compute(child: ChildComputation, runId: RunId) {
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
}
