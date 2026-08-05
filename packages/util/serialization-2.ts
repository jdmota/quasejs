import { inspect } from "node:util";
import * as msgpackr from "msgpackr";
import {
  type $DESERIALIZE_FN,
  type SerializeResult,
  type SerializeTrait,
  $SERIALIZE,
} from "./values";

export class SerializationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class SerializationRegistry {
  private deserializers: Map<string, $DESERIALIZE_FN<any, any>> = new Map();

  constructor() {
    msgpackr.addExtension({
      Class: Object,
      type: 1, // a type code from 1-100
      write: instance => this.serialize(instance),
      read: data => this.deserialize(data),
    });
  }

  registerDeserializer<S, O>(
    name: string,
    deserializer: $DESERIALIZE_FN<S, O>
  ) {
    if (this.deserializers.has(name)) {
      throw new Error(`Name for deserializer already used: ${name}`);
    }
    this.deserializers.set(name, deserializer);
  }

  unregisterDeserializer(name: string) {
    return this.deserializers.delete(name);
  }

  hasSerializer(value: unknown): value is SerializeTrait<any> {
    return (
      value != null &&
      (typeof value === "object" || typeof value === "function") &&
      typeof (value as any)[$SERIALIZE] === "function"
    );
  }

  serialize(value: unknown): SerializeResult<any> {
    if (!this.hasSerializer(value)) {
      throw new SerializationError(`Missing serializer for ${inspect(value)}`);
    }
    try {
      return value[$SERIALIZE]();
    } catch (cause) {
      throw new SerializationError(`Could not serialize ${inspect(value)}`, {
        cause,
      });
    }
  }

  deserialize(serialized: SerializeResult<any>): unknown {
    const { name, version, value } = serialized;
    const deserializer = this.deserializers.get(name);
    if (!deserializer) {
      throw new SerializationError(`Missing deserializer with name ${name}`);
    }
    try {
      return deserializer(serialized);
    } catch (cause) {
      throw new SerializationError(
        `Could not deserialize ${inspect(value)} (${name}@${version})`,
        {
          cause,
        }
      );
    }
  }
}
