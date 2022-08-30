import { ComputationDescription } from "../incremental-lib";
import { ValueDefinition } from "../utils/hash-map";
import { Result } from "../utils/result";
import { BasicComputationDescription } from "./basic";
import { RawComputation } from "./raw";
import { SubscribableComputation } from "./mixins/subscribable";

export type SimpleComputationExec<T> = (
  ctx: SimpleComputationContext
) => Promise<Result<T>>;

type SimpleComputationConfig<T> = {
  readonly exec: SimpleComputationExec<T>;
  readonly root?: boolean;
};

type SimpleComputationContext = {
  readonly get: <T>(
    dep: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<Result<T>>;
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
