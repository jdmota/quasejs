import { Result } from "./monads";

const SERIALIZATION_SYM = Symbol("quase_serialization");

export type Serializer<T, Out> = {
  readonly serialize: (value: T) => Result<Out>;
  readonly deserialize: (out: Out) => Result<T>;
};

export function getObjSerializer<
  T extends { readonly [key: string | symbol | number]: unknown },
  Out,
>(value: T): Serializer<T, Out> | null {
  let serializer = value[SERIALIZATION_SYM];

  if (serializer) {
    return serializer as Serializer<T, Out>;
  }

  if (typeof value.constructor === "function") {
    serializer = (value.constructor as any)[SERIALIZATION_SYM];

    if (serializer) {
      return serializer as Serializer<T, Out>;
    }
  }

  return null;
}

export function setObjSerializer<
  T extends { [key: string | symbol | number]: unknown },
  Out,
>(value: T, serializer: Serializer<T, Out>) {
  (value as any)[SERIALIZATION_SYM] = serializer;
}

export const bigintSerializer: Serializer<bigint, Buffer> = {
  serialize(value) {
    return Result.ok(Buffer.from(value.toString(16)));
  },

  deserialize(buf) {
    return Result.ok(BigInt(`0x${buf.toString()}`));
  },
};
