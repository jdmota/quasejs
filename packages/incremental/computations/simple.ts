import { ComputationDescription } from "../incremental-lib";
import { ValueDefinition } from "../utils/hash-map";
import { ComputationResult } from "../utils/result";
import { BasicComputationDescription } from "./basic";
import { RawComputation } from "./raw";
import type { SubscribableComputation } from "./mixins/subscribable";

export type SimpleComputationExec<T> = (
  ctx: SimpleComputationContext
) => Promise<ComputationResult<T>>;

type SimpleComputationConfig<T> = {
  readonly exec: SimpleComputationExec<T>;
  readonly root?: boolean;
};

type SimpleComputationContext = {
  readonly checkActive: () => void;
  readonly get: <T>(
    desc: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<ComputationResult<T>>;
  readonly getOk: <T>(
    desc: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<T>;
};

const anyValue: ValueDefinition<any> = {
  hash(a) {
    return 0;
  },
  equal(a, b) {
    return a === b;
  },
};

export function newSimpleComputation<T>(config: SimpleComputationConfig<T>) {
  return new BasicComputationDescription<undefined, T>(
    {
      exec: config.exec,
      requestDef: anyValue,
      responseDef: anyValue,
      root: config.root,
    },
    undefined
  );
}
