import {
  type SerializeTrait,
  $EQUALS,
  $FORMAT,
  $HASHCODE,
  $SERIALIZE,
  valueEquals,
  valueFormat,
  valueHashCode,
} from "../../../util/values";
import type { MaybeAsync } from "../../../util/miscellaneous";
import { SerializationError } from "../../../util/serialization";
import { serializationRegistry } from "../../utils/serialization-db";
import type { IncrementalBackend } from "../runtime/backend";
import {
  type IncrementalContextRuntime,
  IncrementalFunctionRuntime,
} from "../runtime/functions";
import { IncrementalComputationDescription } from "./computations";

export type IncrementalFunctionImpl<Input, Output, Cells extends CellsTypes> = (
  ctx: IncrementalContextRuntime<Input, Output, Cells>,
  input: Input
) => MaybeAsync<Output>;

export type CellsTypes = {
  readonly [key in string]: any;
};

export type IncrementalFunctionSchemaOpts<
  Input,
  Output,
  Cells extends CellsTypes,
> = {
  readonly name: string;
  readonly version: number;
  readonly cacheable?: boolean;
  readonly impl: IncrementalFunctionImpl<Input, Output, Cells>;
};

export class IncrementalFunctionSchema<Input, Output, Cells extends CellsTypes>
  implements SerializeTrait<IncrementalFunctionSchemaJSON>
{
  // To distinguish from IncrementalFunctionSchemaOpts
  private readonly instance = true;

  constructor(
    readonly name: string,
    readonly version: number,
    readonly cacheable: boolean,
    readonly impl: IncrementalFunctionImpl<Input, Output, Cells>
  ) {}

  [$SERIALIZE]() {
    return {
      name: "IncrementalFunctionSchema",
      version: 1,
      value: {
        name: this.name,
        version: this.version,
      },
    };
  }
}

type IncrementalFunctionSchemaJSON = {
  readonly name: string;
  readonly version: number;
};

export class IncrementalFunctionCallDescription<
  Input,
  Output,
  Cells extends CellsTypes,
> extends IncrementalComputationDescription<
  IncrementalFunctionRuntime<Input, Output, Cells>
> {
  private inputHash: number | null = null;

  constructor(
    readonly schema: IncrementalFunctionSchema<Input, Output, Cells>,
    readonly input: Input
  ) {
    super();
  }

  create(backend: IncrementalBackend<any>) {
    functions.check(this.schema);
    return new IncrementalFunctionRuntime(backend, this);
  }

  private getInputHash(): number {
    return this.inputHash ?? (this.inputHash = valueHashCode(this.input));
  }

  [$EQUALS](other: unknown): boolean {
    return (
      other instanceof IncrementalFunctionCallDescription &&
      this.schema === other.schema &&
      valueEquals(this.input, other.input)
    );
  }

  [$HASHCODE]() {
    return this.schema.name.length + this.getInputHash();
  }

  isCacheable(): boolean {
    return this.schema.cacheable;
  }

  getCacheKey() {
    return `FunctionCall{${this.schema.name},${this.schema.version},${this.getInputHash()}}`;
  }

  [$FORMAT]() {
    return `${this.schema.name}@${this.schema.version}(${valueFormat(this.input)})`;
  }

  [$SERIALIZE]() {
    return {
      name: "IncrementalFunctionCallDescription",
      version: 1,
      value: {
        schema: this.schema,
        input: this.input,
      } satisfies IncrementalFunctionCallDescriptionJSON,
    };
  }
}

type IncrementalFunctionCallDescriptionJSON = {
  readonly schema: IncrementalFunctionSchema<any, any, any>;
  readonly input: any;
};

serializationRegistry.registerDeserializer<
  IncrementalFunctionCallDescriptionJSON,
  IncrementalFunctionCallDescription<any, any, any>
>("IncrementalFunctionCallDescription", ({ value }) => {
  return new IncrementalFunctionCallDescription(value.schema, value.input);
});

export type AnyIncrementalFunctionCallDescription =
  IncrementalFunctionCallDescription<any, any, any>;

export class IncrementalFunctionRegistry {
  public static SINGLETON = new IncrementalFunctionRegistry();
  private readonly funcs = new Map<
    string,
    IncrementalFunctionSchema<any, any, any>
  >();

  private constructor() {
    serializationRegistry.registerDeserializer<
      IncrementalFunctionSchemaJSON,
      IncrementalFunctionSchema<any, any, any>
    >("IncrementalFunctionSchema", ({ value }) => {
      const desc = this.funcs.get(value.name);
      if (!desc) {
        throw new SerializationError(
          `Function ${value.name} was not registered`
        );
      }
      if (desc.version !== value.version) {
        throw new SerializationError(
          `Deserialized version ${value.version} of function ${value.name} but found version ${desc.version} in registry`
        );
      }
      return desc;
    });
  }

  register<Input, Output, Cells extends CellsTypes>(
    opts: IncrementalFunctionSchemaOpts<Input, Output, Cells>
  ) {
    if (this.funcs.has(opts.name)) {
      throw new Error(`Function '${opts.name}' was already registered`);
    }
    const schema = new IncrementalFunctionSchema(
      opts.name,
      opts.version,
      opts.cacheable ?? true,
      opts.impl
    );
    this.funcs.set(opts.name, schema);
    return schema;
  }

  check(schema: IncrementalFunctionSchema<any, any, any>) {
    const { name } = schema;
    const current = this.funcs.get(name);
    if (!current) {
      throw new Error(`Function schema '${name}' was not registered`);
    }
    if (current !== schema) {
      throw new Error(
        `'${name}' is associated with a different function schema`
      );
    }
  }
}

export const functions = IncrementalFunctionRegistry.SINGLETON;
