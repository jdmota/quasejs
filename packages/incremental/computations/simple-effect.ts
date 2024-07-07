import { ComputationDescription } from "../incremental-lib";
import { ValueDefinition } from "../utils/hash-map";
import { ComputationResult } from "../utils/result";
import { RawComputation } from "./raw";
import { CleanupFn, EffectComputationDescription } from "./effect";
import type { SubscribableComputation } from "./mixins/subscribable";

export type SimpleEffectComputationExec<T> = (
  ctx: SimpleEffectComputationContext
) => Promise<ComputationResult<T>>;

type SimpleEffectComputationConfig<T> = {
  readonly exec: SimpleEffectComputationExec<T>;
};

type SimpleEffectComputationContext = {
  readonly checkActive: () => void;
  readonly get: <T>(
    dep: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<ComputationResult<T>>;
  readonly cleanup: (fn: CleanupFn) => void;
};

const anyValue: ValueDefinition<any> = {
  hash(a) {
    return 0;
  },
  equal(a, b) {
    return a === b;
  },
};

export function newSimpleEffectComputation<T>(
  config: SimpleEffectComputationConfig<T>
) {
  return new EffectComputationDescription<undefined, T>(
    {
      exec: config.exec,
      requestDef: anyValue,
    },
    undefined
  );
}
