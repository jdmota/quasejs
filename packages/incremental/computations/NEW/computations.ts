import type { IncrementalBackend } from "./backend";
import type { IncrementalComputationRuntime } from "./computation-runtime";

export abstract class IncrementalComputationDescription<
  C extends IncrementalComputationRuntime<any, any>,
> {
  abstract create(registry: IncrementalBackend): C;
  abstract equal(other: unknown): boolean;
  abstract hash(): number;
  abstract getCacheKey(): string;
}
