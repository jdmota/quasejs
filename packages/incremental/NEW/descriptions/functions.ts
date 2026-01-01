import type { MaybeAsync } from "../../../util/miscellaneous";
import { SerializationError } from "../../../util/serialization";
import { serializationDB } from "../../utils/serialization-db";
import type { IncrementalBackend } from "../runtime/backend";
import {
  type IncrementalContextRuntime,
  IncrementalFunctionRuntime,
} from "../runtime/functions";
import type { ValueDescription } from "./values";
import { IncrementalComputationDescription } from "./computations";

export type IncrementalFunctionImpl<
  Input,
  Output,
  CellDefs extends CellValueDescriptions,
> = (
  ctx: IncrementalContextRuntime<Input, Output, CellDefs>,
  input: Input
) => MaybeAsync<Output>;

export type CellValueDescriptions = {
  readonly [key in string]: ValueDescription<any, any>;
};

export type IncrementalFunctionSchemaOpts<
  Input,
  Output,
  CellDefs extends CellValueDescriptions,
> = {
  readonly name: string;
  readonly version: number;
  readonly inputDef: ValueDescription<Input, any>;
  readonly outputDef: ValueDescription<Output, any>;
  readonly cellsDef: CellDefs;
  readonly cacheable?: boolean;
  readonly impl: IncrementalFunctionImpl<Input, Output, CellDefs>;
};

export class IncrementalFunctionSchema<
  Input,
  Output,
  CellDefs extends CellValueDescriptions,
> {
  // To distinguish from IncrementalFunctionSchemaOpts
  private readonly instance = true;

  constructor(
    readonly name: string,
    readonly version: number,
    readonly inputDef: ValueDescription<Input, any>,
    readonly outputDef: ValueDescription<Output, any>,
    readonly cellsDef: CellDefs,
    readonly cacheable: boolean,
    readonly impl: IncrementalFunctionImpl<Input, Output, CellDefs>
  ) {}
}

type IncrementalFunctionSchemaJSON = {
  readonly name: string;
  readonly version: number;
};

export class IncrementalFunctionCallDescription<
  Input,
  Output,
  CellDefs extends CellValueDescriptions,
> extends IncrementalComputationDescription<
  IncrementalFunctionRuntime<Input, Output, CellDefs>
> {
  private inputHash: number | null = null;

  constructor(
    readonly schema: IncrementalFunctionSchema<Input, Output, CellDefs>,
    readonly input: Input
  ) {
    super();
  }

  create(backend: IncrementalBackend) {
    functions.check(this.schema);
    return new IncrementalFunctionRuntime(backend, this);
  }

  private getInputHash(): number {
    return (
      this.inputHash ?? (this.inputHash = this.schema.inputDef.hash(this.input))
    );
  }

  equal(other: unknown): boolean {
    return (
      other instanceof IncrementalFunctionCallDescription &&
      this.schema === other.schema &&
      this.schema.inputDef.equal(this.input, other.input)
    );
  }

  hash() {
    return this.schema.name.length + this.getInputHash();
  }

  getCacheKey() {
    return `FunctionCall{${this.schema.name},${this.schema.version},${this.getInputHash()}}`;
  }
}

type IncrementalFunctionCallDescriptionJSON = {
  readonly schema: IncrementalFunctionSchema<any, any, any>;
  readonly inputJSON: any;
};

export class IncrementalFunctionRegistry {
  public static SINGLETON = new IncrementalFunctionRegistry();
  private readonly funcs = new Map<
    string,
    IncrementalFunctionSchema<any, any, any>
  >();

  private constructor() {
    serializationDB.register<
      IncrementalFunctionSchema<any, any, any>,
      IncrementalFunctionSchemaJSON
    >(IncrementalFunctionSchema, {
      name: "IncrementalFunctionSchema",
      serialize: value => {
        return {
          name: value.name,
          version: value.version,
        };
      },
      deserialize: out => {
        const desc = this.funcs.get(out.name);
        if (!desc) {
          throw new SerializationError(
            `Function ${out.name} was not registered`
          );
        }
        if (desc.version !== out.version) {
          throw new SerializationError(
            `Deserialized version ${out.version} of function ${out.name} but found version ${desc.version} in registry`
          );
        }
        return desc;
      },
    });

    serializationDB.register<
      IncrementalFunctionCallDescription<any, any, any>,
      IncrementalFunctionCallDescriptionJSON
    >(IncrementalFunctionCallDescription, {
      name: "IncrementalFunctionCallDescription",
      serialize: value => {
        return {
          schema: value.schema,
          inputJSON: value.schema.inputDef.serialize(value.input),
        };
      },
      deserialize: out => {
        return new IncrementalFunctionCallDescription(
          out.schema,
          out.schema.inputDef.deserialize(out.inputJSON)
        );
      },
    });
  }

  register<Input, Output, CellDefs extends CellValueDescriptions>(
    opts: IncrementalFunctionSchemaOpts<Input, Output, CellDefs>
  ) {
    if (this.funcs.has(opts.name)) {
      throw new Error(`Function '${opts.name}' was already registered`);
    }
    const schema = new IncrementalFunctionSchema(
      opts.name,
      opts.version,
      opts.inputDef,
      opts.outputDef,
      opts.cellsDef,
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
