import { ValueDefinition } from "../utils/hash-map";
import {
  EffectComputationDescription,
  EffectComputationConfig,
  EffectComputationExec,
} from "./effect";

export type SimpleEffectComputationExec<T> = EffectComputationExec<
  undefined,
  T
>;

export type SimpleEffectComputationConfig<T> = Omit<
  EffectComputationConfig<undefined, T>,
  "requestDef" | "responseDef"
>;

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
      responseDef: anyValue,
      root: config.root,
    },
    undefined
  );
}
