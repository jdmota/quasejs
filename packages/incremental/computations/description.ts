import type { ComputationRegistry } from "../incremental-lib";
import type { AnyRawComputation } from "./raw";

export abstract class ComputationDescription<C extends AnyRawComputation> {
  abstract create(registry: ComputationRegistry<any>): C;
  abstract equal<O extends AnyRawComputation>(
    other: ComputationDescription<O>
  ): boolean;
  abstract hash(): number;
  abstract getCacheKey(): string;
}

export type AnyComputationDescription =
  ComputationDescription<AnyRawComputation>;
