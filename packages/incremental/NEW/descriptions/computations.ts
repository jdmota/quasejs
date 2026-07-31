import type { IncrementalBackend } from "../runtime/backend";
import type { IncrementalComputationRuntime } from "../runtime/computations";
import type { IncrementalCellOwnerDescription } from "./cells";
import type { ValueDescription } from "./values";

export type ResultOfComputation<C> =
  C extends IncrementalComputationRuntime<any, infer Output> ? Output : never;

export abstract class IncrementalComputationDescription<
  C extends IncrementalComputationRuntime<any, any>,
> implements IncrementalCellOwnerDescription
{
  abstract create(registry: IncrementalBackend): C;
  abstract equal(other: unknown): boolean;
  abstract hash(): number;
  abstract getOutputDef(): ValueDescription<ResultOfComputation<C>, any>;
  abstract isCacheable(): boolean;
  abstract getCacheKey(): string;
  abstract format(): string;
}

export type AnyIncrementalComputationDescription =
  IncrementalComputationDescription<IncrementalComputationRuntime<any, any>>;
