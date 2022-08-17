import { ParentComputation } from "./parent";
import { RawComputation } from "./raw";

export interface ChildComputation {
  readonly childrenMixin: ChildComputationMixin;

  inv(): void;
}

export class ChildComputationMixin {
  public readonly source: RawComputation<any, any> & ChildComputation;
  readonly parents: Set<ParentComputation>;

  constructor(source: RawComputation<any, any> & ChildComputation) {
    this.source = source;
    this.parents = new Set();
  }

  isOrphan(): boolean {
    return this.parents.size === 0;
  }
}
