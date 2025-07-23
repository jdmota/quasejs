import { inspect } from "node:util";
import type { Class } from "type-fest";
import * as msgpackr from "msgpackr";

export type Serializer<T, Out> = {
  readonly serialize: (value: T) => Out;
  readonly deserialize: (out: Out) => T;
};

export type NamedSerializer<T, Out> = {
  readonly name: string;
  readonly serialize: (value: T) => Out;
  readonly deserialize: (out: Out) => T;
};

export type SerializedWithName<Out> = Readonly<{
  name: string;
  value: Out;
}>;

export class SerializationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class MissingConstructorSerializerError extends SerializationError {
  constructor(public readonly constructorName: string) {
    super(`Missing serializer for instance of ${constructorName}`);
  }
}

const UNIQUE_OBJ_NAME = "$$QUASE_SER_UNIQUE_OBJ$$";

export class SerializationDB {
  private nameToSerializer: Map<string, NamedSerializer<any, any>> = new Map();
  private ctorToSerializer: Map<Class<any>, NamedSerializer<any, any>> =
    new Map();

  readonly uniqueObjDB = new UniqueObjsDB();

  constructor() {
    msgpackr.addExtension({
      Class: Object,
      type: 1, // a type code from 1-100
      write: instance => this.serialize(instance),
      read: data => this.deserialize(data),
    });
  }

  serialize(value: unknown): SerializedWithName<unknown> {
    const uniqueData = this.uniqueObjDB.getByObj(value);
    if (uniqueData) {
      return {
        name: UNIQUE_OBJ_NAME,
        value: {
          name: uniqueData.name,
          version: uniqueData.version,
        } satisfies SerializedObject,
      };
    }
    const constructor = (value as any).constructor;
    if (!constructor) {
      throw new SerializationError(
        `Missing serializer for instance without constructor`
      );
    }
    const serializer = this.ctorToSerializer.get(constructor);
    if (!serializer) {
      throw new MissingConstructorSerializerError(constructor.name);
    }
    try {
      return {
        name: serializer.name,
        value: serializer.serialize(value),
      };
    } catch (cause) {
      throw new SerializationError(
        `Could not serialize ${inspect(value)} (name: ${serializer.name})`,
        {
          cause,
        }
      );
    }
  }

  deserialize({ name, value }: SerializedWithName<unknown>): unknown {
    if (name === UNIQUE_OBJ_NAME) {
      const serData =
        value && typeof value === "object"
          ? (value as SerializedObject)
          : undefined;
      if (serData == null) {
        throw new UniqueObjectSerializationError(
          `Cannot deserialize unique object (invalid format)`
        );
      }
      const uniqueData = this.uniqueObjDB.getByName(serData.name);
      if (uniqueData) {
        if (uniqueData.version === serData.version) {
          return uniqueData.obj;
        }
        throw new UniqueObjectSerializationError(
          `Cannot deserialize unique object ${serData.name} (from version ${serData.version} to ${uniqueData.version})`
        );
      }
      throw new UniqueObjectSerializationError(
        `Cannot deserialize unique object ${serData.name} (name not found)`
      );
    }
    const serializer = this.nameToSerializer.get(name);
    if (!serializer) {
      throw new SerializationError(`Missing serializer with name ${name}`);
    }
    try {
      return serializer.deserialize(value);
    } catch (cause) {
      throw new SerializationError(
        `Could not deserialize ${inspect(value)} (name: ${serializer.name})`,
        {
          cause,
        }
      );
    }
  }

  register<T, Out>(ctor: Class<T>, serializer: NamedSerializer<T, Out>) {
    if (this.nameToSerializer.has(serializer.name)) {
      throw new Error("Name for serializer already used");
    }

    if (this.ctorToSerializer.has(ctor)) {
      throw new Error("Class already registered with serializer");
    }

    this.ctorToSerializer.set(ctor, serializer);
    this.nameToSerializer.set(serializer.name, serializer);
  }

  unregister(ctor: Class<any>) {
    const ser = this.ctorToSerializer.get(ctor);
    if (ser) {
      this.ctorToSerializer.delete(ctor);
      this.nameToSerializer.delete(ser.name);
    }
  }
}

const SERIALIZATION_SYM = Symbol("quase_serialization");

export function getObjSerializer<
  T extends { readonly [key: string | symbol | number]: unknown },
>(value: T): Serializer<T, any> | null {
  let serializer = value[SERIALIZATION_SYM];

  if (serializer) {
    return serializer as Serializer<T, any>;
  }

  if (typeof value.constructor === "function") {
    serializer = (value.constructor as any)[SERIALIZATION_SYM];

    if (serializer) {
      return serializer as Serializer<T, any>;
    }
  }

  return null;
}

export function setObjSerializer<
  T extends { [key: string | symbol | number]: unknown },
>(value: T, serializer: Serializer<T, any>) {
  (value as any)[SERIALIZATION_SYM] = serializer;
}

export const bigintSerializer: Serializer<bigint, Buffer> = {
  serialize(value) {
    return Buffer.from(value.toString(16));
  },

  deserialize(buf) {
    return BigInt(`0x${buf.toString()}`);
  },
};

// Serialization of unique objects (such as functions)

type SerializedObject = {
  readonly name: string;
  readonly version: number;
};

export type NamedObject = {
  readonly name: string;
  readonly version: number;
  readonly obj: Object;
};

class MyObject {}

export class UniqueObjsDB {
  private nameToObj: Map<string, NamedObject> = new Map();
  private objToName: Map<unknown, NamedObject> = new Map();

  getByName(name: string) {
    return this.nameToObj.get(name);
  }

  getByObj(obj: unknown) {
    return this.objToName.get(obj);
  }

  // If the constructor is exactly Object, msgpackr will use the routine to serialize plain objects
  // and will not get to the code that uses the extensions
  // So, we patch the constructor
  private patch<T extends Object>(obj: T): T {
    if (obj.constructor === Object) {
      obj.constructor = MyObject;
    }
    return obj;
  }

  register<T extends Object>(name: string, version: number, obj: T): T {
    if (this.nameToObj.has(name)) {
      throw new Error(`Name ${name} for object already used`);
    }

    if (this.objToName.has(obj)) {
      throw new Error("Object already registered");
    }

    const objWithName: NamedObject = {
      name,
      version,
      obj,
    };
    this.nameToObj.set(name, objWithName);
    this.objToName.set(obj, objWithName);
    return this.patch(obj);
  }

  unregister(obj: Object) {
    const objWithName = this.objToName.get(obj);
    if (objWithName) {
      this.nameToObj.delete(objWithName.name);
      this.objToName.delete(objWithName.obj);
    }
  }
}

export class UniqueObjectSerializationError extends SerializationError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}
