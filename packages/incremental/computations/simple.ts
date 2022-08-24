import { ComputationDescription } from "../incremental-lib";
import { ValueDefinition } from "../utils/hash-map";
import { Result } from "../utils/result";
import { BasicComputationDescription } from "./basic";
import { RawComputation } from "./raw";
import { SubscribableComputation } from "./mixins/subscribable";

type SimpleComputationExec = (
  ctx: SimpleComputationContext
) => Promise<Result<undefined>>;

type SimpleComputationConfig = {
  readonly exec: SimpleComputationExec;
  readonly root?: boolean;
};

type SimpleComputationContext = {
  readonly active: () => void;
  readonly get: <T>(
    dep: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) => Promise<Result<T>>;
};

const undefinedValue: ValueDefinition<undefined> = {
  hash(a) {
    return 0;
  },
  equal(a, b) {
    return a === b;
  },
};

export function newSimpleComputation(config: SimpleComputationConfig) {
  return new BasicComputationDescription(
    {
      exec: config.exec,
      requestDef: undefinedValue,
      responseDef: undefinedValue,
      root: config.root,
    },
    undefined
  );
}
