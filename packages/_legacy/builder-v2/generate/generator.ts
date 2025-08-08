import fs from "fs-extra";

function assertIdentifier(id: string) {
  if (/^[a-z]+[a-z0-9]*$/i.test(id)) {
    return id;
  }
  throw new Error(`${id} is not a valid identifier`);
}

type ObjectType = Readonly<{
  t: "object";
  entries: readonly (readonly [string, Type])[];
}>;
type ArrayType = Readonly<{
  t: "array";
  item: Type;
}>;
type StringType = Readonly<{
  t: "string";
}>;
type NumberType = Readonly<{
  t: "number";
}>;
type BooleanType = Readonly<{
  t: "boolean";
}>;
type OptionalType = Readonly<{
  t: "optional";
  type: Type;
}>;
export type AliasType = Readonly<{
  t: "alias";
  name: string;
  type: Type;
}>;
type Type =
  | ObjectType
  | ArrayType
  | StringType
  | NumberType
  | BooleanType
  | OptionalType
  | AliasType;

export const string: StringType = { t: "string" };
export const number: NumberType = { t: "number" };
export const boolean: BooleanType = { t: "boolean" };

export const optional = (type: Type): OptionalType => ({ t: "optional", type });

export const array = (item: Type): ArrayType => ({ t: "array", item });

export const object = (entries: ObjectType["entries"]): ObjectType => ({
  t: "object",
  entries: [...entries].sort(([keyA], [keyB]) =>
    assertIdentifier(keyA).localeCompare(assertIdentifier(keyB))
  ),
});

export const alias = (name: string, type: Type): AliasType => ({
  t: "alias",
  name: assertIdentifier(name),
  type,
});

type GenResult = {
  ts: string;
  validator: string;
  serializer: string;
  hashCode: string;
  equals: string;
};

type Gens = {
  string: (ctx: GenCtx, id: string, type: StringType) => GenResult;
  number: (ctx: GenCtx, id: string, type: NumberType) => GenResult;
  boolean: (ctx: GenCtx, id: string, type: BooleanType) => GenResult;
  object: (ctx: GenCtx, id: string, type: ObjectType) => GenResult;
  array: (ctx: GenCtx, id: string, type: ArrayType) => GenResult;
  optional: (ctx: GenCtx, id: string, type: OptionalType) => GenResult;
  alias: (ctx: GenCtx, id: string, type: AliasType) => GenResult;
};

class GenCtx {
  private uuid: number;
  private ids: Map<Type, string>;
  private generated: Map<string, GenResult>;

  constructor() {
    this.uuid = 1;
    this.ids = new Map();
    this.generated = new Map();
  }

  getResults(): ReadonlyMap<string, GenResult> {
    return this.generated;
  }

  private isPrimitive(type: Type) {
    return type.t === "string" || type.t === "number" || type.t === "boolean";
  }

  private genId(type: Type) {
    if (type.t === "alias") {
      return type.name;
    }
    if (this.isPrimitive(type)) {
      return type.t;
    }
    return `\$${this.uuid++}`;
  }

  gen(type: Type) {
    let id = this.ids.get(type);
    if (id == null) {
      id = this.genId(type);
      this.ids.set(type, id);

      const prefix = type.t === "alias" ? "export " : "";

      const result = generators[type.t](this, id, type as any);
      this.generated.set(id, {
        ts: this.isPrimitive(type) ? "" : `${prefix}type ${id} = ${result.ts};`,
        validator: `${prefix}const validator${id} = ${result.validator};`,
        serializer: `${prefix}const serializer${id} = ${result.serializer};`,
        hashCode: `${prefix}const hashCode${id} = ${result.hashCode};`,
        equals: `${prefix}const equals${id} = ${result.equals};`,
      });
    }

    return id;
  }

  genTs(type: Type) {
    if (type.t === "string") {
      return "string";
    }
    if (type.t === "number") {
      return "number";
    }
    if (type.t === "boolean") {
      return "boolean";
    }
    if (type.t === "optional") {
      if (type.type.t === "string") {
        return "string | null";
      }
      if (type.type.t === "number") {
        return "number | null";
      }
      if (type.type.t === "boolean") {
        return "boolean | null";
      }
      if (type.type.t === "alias") {
        return `${type.type.name} | null`;
      }
    }
    return this.gen(type);
  }

  genValidator(type: Type) {
    return `validator${this.gen(type)}`;
  }

  genSerializer(type: Type) {
    return `serializer${this.gen(type)}`;
  }

  genHashCode(type: Type) {
    return `hashCode${this.gen(type)}`;
  }

  genEquals(type: Type) {
    return `equals${this.gen(type)}`;
  }
}

/*function escapeStr(str: string) {
  return str.replace(/[\\"'`$]/g, "\\$&").replace(/\u0000/g, "\\0");
}*/

const generators: Gens = {
  string: () => {
    return {
      ts: "string",
      validator: `() => "TODO"`,
      serializer: `((str: string): string => JSON.stringify(str))`,
      hashCode: `() => "TODO"`,
      equals: `((a: string, b: string): boolean => a === b)`,
    };
  },
  number: () => {
    return {
      ts: "number",
      validator: `() => "TODO"`,
      serializer: `((num: number): string => JSON.stringify(num))`,
      hashCode: `() => "TODO"`,
      equals: `((a: number, b: number): boolean => a === b)`,
    };
  },
  boolean: () => {
    return {
      ts: "boolean",
      validator: `() => "TODO"`,
      serializer: `((b: boolean): string => (b ? "true" : "false"))`,
      hashCode: `() => "TODO"`,
      equals: `((a: boolean, b: boolean): boolean => a === b)`,
    };
  },
  object: (ctx, id, type) => {
    return {
      ts: `Readonly<{${type.entries
        .map(([key, type]) => `${key}:${ctx.genTs(type)};`)
        .join("")}}>`,
      validator: `() => "TODO"`,
      serializer: `(o: ${id}): string => \`{${type.entries
        .map(
          ([key, type]) => `"${key}":\${${ctx.genSerializer(type)}(o.${key})}`
        )
        .join(",")}}\``,
      hashCode: `() => "TODO"`,
      equals: `(): boolean => "TODO"`,
    };
  },
  array: (ctx, id, type) => {
    return {
      ts: `readonly (${ctx.genTs(type.item)})[]`,
      validator: `() => "TODO"`,
      serializer: `(a: ${id}): string => \`[\${a.map(${ctx.genSerializer(
        type.item
      )}).join(",")}]\``,
      hashCode: `() => "TODO"`,
      equals: `(): boolean => "TODO"`,
    };
  },
  optional: (ctx, id, type) => {
    return {
      ts: `${ctx.genTs(type.type)} | null`,
      validator: `() => "TODO"`,
      serializer: `(v: ${id}): string => (v == null ? "null" : ${ctx.genSerializer(
        type.type
      )}(v))`,
      hashCode: `() => "TODO"`,
      equals: `(): boolean => "TODO"`,
    };
  },
  alias: (ctx, _id, { type }) => {
    return {
      ts: ctx.genTs(type),
      validator: ctx.genValidator(type),
      serializer: ctx.genSerializer(type),
      hashCode: ctx.genHashCode(type),
      equals: ctx.genEquals(type),
    };
  },
};

export async function generate(filename: string, allSpecs: AliasType[]) {
  const genCtx = new GenCtx();

  for (const spec of allSpecs) {
    genCtx.gen(spec);
  }

  let code: string[] = [`/* eslint-disable */`];

  for (const result of genCtx.getResults().values()) {
    code.push(result.ts);
    // code.push(result.validator);
    code.push(result.serializer);
    // code.push(result.hashCode);
    // code.push(result.equals);
  }

  const data = code.filter(Boolean).join("\n");

  await fs.writeFile(filename, data);

  return data;
}
