import type {
  $EQUALS,
  $FORMAT,
  $HASHCODE,
  $SERIALIZE,
  SerializeResult,
} from "../../util/values";
import type { IncrementalBackend } from "../runtime/backend";
import type { IncrementalComputationRuntime } from "../runtime/computations";
import type { IncrementalCellOwnerDescription } from "./cells";

export type ResultOfComputation<C> =
  C extends IncrementalComputationRuntime<any, infer Output> ? Output : never;

export abstract class IncrementalComputationDescription<
  C extends IncrementalComputationRuntime<any, any>,
> implements IncrementalCellOwnerDescription
{
  abstract create(registry: IncrementalBackend<any>): C;
  abstract [$EQUALS](other: unknown): boolean;
  abstract [$HASHCODE](): number;
  abstract isCacheable(): boolean;
  abstract getCacheKey(): string;
  abstract [$FORMAT](): string;
  abstract [$SERIALIZE](): SerializeResult<any>;
}

export type AnyIncrementalComputationDescription =
  IncrementalComputationDescription<IncrementalComputationRuntime<any, any>>;
