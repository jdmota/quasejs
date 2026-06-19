import type { IncrementalBackend } from "../runtime/backend";
import type {
  IncrementalComputationRuntime,
  ResultTypeOfComputation,
} from "../runtime/computations";
import type { IncrementalCellOwnerDescription } from "./cells";
import type { ValueDescription } from "./values";

export abstract class IncrementalComputationDescription<
  C extends IncrementalComputationRuntime<any, any>,
> implements IncrementalCellOwnerDescription
{
  abstract create(registry: IncrementalBackend): C;
  abstract equal(other: unknown): boolean;
  abstract hash(): number;
  abstract getOutputDef(): ValueDescription<ResultTypeOfComputation<C>, any>;
  abstract isCacheable(): boolean;
  abstract getCacheKey(): string;
  abstract format(): string;
}

export type AnyIncrementalComputationDescription =
  IncrementalComputationDescription<IncrementalComputationRuntime<any, any>>;
