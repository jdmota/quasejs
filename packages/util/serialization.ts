import type { Class } from "type-fest";
import { Result } from "./monads";

export type Serializer<T, Out> = {
  readonly serialize: (value: T) => Result<Out>;
  readonly deserialize: (out: Out) => Result<T>;
};

export type NamedSerializer<T, Out> = {
  readonly name: string;
  readonly serialize: (value: T) => Result<Out>;
  readonly deserialize: (out: Out) => Result<T>;
};

export class SerializationDB {
  private names: Set<string> = new Set();
  private ctorToSerializer: Map<Class<any>, NamedSerializer<any, any>> =
    new Map();

  get<T, Out>(ctor: Class<T>): NamedSerializer<T, Out> | undefined {
    return this.ctorToSerializer.get(ctor);
  }

  register<T, Out>(ctor: Class<T>, serializer: NamedSerializer<T, Out>) {
    if (this.names.has(serializer.name)) {
      throw new Error("Name for serializer already used");
    }

    if (this.ctorToSerializer.has(ctor)) {
      throw new Error("Class already registered with serializer");
    }

    this.ctorToSerializer.set(ctor, serializer);
    this.names.add(serializer.name);
  }

  unregister(ctor: Class<any>) {
    const ser = this.ctorToSerializer.get(ctor);
    if (ser) {
      this.ctorToSerializer.delete(ctor);
      this.names.delete(ser.name);
    }
  }
}

const SERIALIZATION_SYM = Symbol("quase_serialization");

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
