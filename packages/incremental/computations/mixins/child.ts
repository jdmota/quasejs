import { ParentComputation } from "./parent";
import { AnyRawComputation } from "../raw";

export interface ChildComputation {
  readonly childMixin: ChildComputationMixin;
  onInEdgeAddition(node: ParentComputation): void;
  onInEdgeRemoval(node: ParentComputation): void;
}

export class ChildComputationMixin {
  public readonly source: AnyRawComputation & ChildComputation;
  readonly parents: Set<AnyRawComputation & ParentComputation>;

  constructor(source: AnyRawComputation & ChildComputation) {
    this.source = source;
    this.parents = new Set();
  }

  isOrphan(): boolean {
    return this.parents.size === 0;
  }
}
