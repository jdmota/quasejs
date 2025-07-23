import type { ComputationRegistry } from "../incremental-lib";
import type { AnyRawComputation } from "./raw";

export abstract class ComputationDescription<C extends AnyRawComputation> {
  abstract create(registry: ComputationRegistry): C;
  abstract equal<O extends AnyRawComputation>(
    other: ComputationDescription<O>
  ): boolean;
  abstract hash(): number;
  abstract key(): string;
}

export type AnyComputationDescription =
  ComputationDescription<AnyRawComputation>;
