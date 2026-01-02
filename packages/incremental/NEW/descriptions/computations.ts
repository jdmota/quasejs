import type { IncrementalBackend } from "../runtime/backend";
import type { IncrementalComputationRuntime } from "../runtime/computations";
import type { IncrementalCellOwnerDescription } from "./cells";

export abstract class IncrementalComputationDescription<
  C extends IncrementalComputationRuntime<any, any>,
> implements IncrementalCellOwnerDescription
{
  abstract create(registry: IncrementalBackend): C;
  abstract equal(other: unknown): boolean;
  abstract hash(): number;
  abstract getCacheKey(): string;
}

export type AnyIncrementalComputationDescription =
  IncrementalComputationDescription<IncrementalComputationRuntime<any, any>>;
