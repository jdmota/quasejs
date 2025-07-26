import { anyValue } from "../utils/hash-map";
import {
  BasicComputationConfig,
  BasicComputationDescription,
  BasicComputationExec,
} from "./basic";

export type SimpleComputationExec<T> = BasicComputationExec<undefined, T>;

export type SimpleComputationConfig<T> = Omit<
  BasicComputationConfig<undefined, T>,
  "requestDef" | "responseDef"
>;

export function newSimpleComputation<T>(config: SimpleComputationConfig<T>) {
  return new BasicComputationDescription<undefined, T>(
    {
      key: config.key,
      exec: config.exec,
      requestDef: anyValue,
      responseDef: anyValue,
    },
    undefined
  );
}
