import type { Version } from "../../utils/versions";

export type ValueDescription<T, Out> = {
  readonly equal: (a: T, b: T) => boolean;
  readonly hash: (a: T) => number;
  readonly serialize: (value: T) => Out;
  readonly deserialize: (out: Out) => T;
};

export type ValueOfDef<Def> =
  Def extends ValueDescription<infer T, any> ? T : never;

export function valueDesc<T, Out>(
  equal: (a: T, b: T) => boolean,
  hash: (a: T) => number,
  serialize: (value: T) => Out,
  deserialize: (out: Out) => T
): ValueDescription<T, Out> {
  return {
    equal,
    hash,
    serialize,
    deserialize,
  };
}

export type VersionedValue<T> = readonly [T, Version];
