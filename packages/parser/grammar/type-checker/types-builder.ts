// Build grammar types

import { assertion, never } from "../../../util/miscellaneous.ts";
import { type Location } from "../../runtime/input.ts";

export interface GTypeMap {
  func: GFuncType;
  readObject: GReadObjectType;
  readArray: GReadArrayType;
  array: GArrayType;
  null: GNullType;
  string: GStringType;
  int: GIntType;
  bool: GBoolType;
  union: GUnionType;
  inter: GInterType;
  unknown: GTopType;
  never: GBotType;
  rec: GRecursiveType;
  recVar: GRecursiveVarType;
}

type GTypeNames = keyof GTypeMap;
export type GType = GTypeMap[GTypeNames];

export type GFuncType = {
  readonly type: "func";
  readonly args: readonly GType[];
  readonly ret: GType;
  loc: Location | null;
};

function funcType(args: readonly GType[], ret: GType): GFuncType {
  return {
    type: "func",
    args,
    ret,
    loc: null,
  };
}

export type GReadObjectType = {
  readonly type: "readObject";
  readonly fields: ReadonlyMap<string, GType>;
  loc: Location | null;
};

function readObjectType(
  fields: Readonly<Record<string, GType>>
): GReadObjectType {
  return {
    type: "readObject",
    fields: new Map(Object.entries(fields)),
    loc: null,
  };
}

export type GReadArrayType = {
  readonly type: "readArray";
  readonly component: GType;
  loc: Location | null;
};

function readArrayType(component: GType): GReadArrayType {
  return { type: "readArray", component, loc: null };
}

export type GArrayType = {
  readonly type: "array";
  readonly component: GType;
  loc: Location | null;
};

function arrayType(component: GType): GArrayType {
  return { type: "array", component, loc: null };
}

export type GNullType = {
  readonly type: "null";
  loc: Location | null;
};

function nullType(): GNullType {
  return {
    type: "null",
    loc: null,
  };
}

export type GStringType = {
  readonly type: "string";
  loc: Location | null;
};

function stringType(): GStringType {
  return {
    type: "string",
    loc: null,
  };
}

export type GIntType = {
  readonly type: "int";
  loc: Location | null;
};

function intType(): GIntType {
  return {
    type: "int",
    loc: null,
  };
}

export type GBoolType = {
  readonly type: "bool";
  loc: Location | null;
};

function boolType(): GBoolType {
  return {
    type: "bool",
    loc: null,
  };
}

export type GTopType = {
  readonly type: "top";
  loc: Location | null;
};

function unknownType(): GTopType {
  return {
    type: "top",
    loc: null,
  };
}

export type GBotType = {
  readonly type: "bot";
  loc: Location | null;
};

function neverType(): GBotType {
  return {
    type: "bot",
    loc: null,
  };
}

export type GUnionType = {
  readonly type: "union";
  readonly types: readonly GType[];
  loc: Location | null;
};

function unionType(types: readonly GType[]): GType {
  types = types.filter(t => t.type !== "bot");
  if (types.length === 0) return typeBuilder.never();
  if (types.length === 1) return types[0];
  return { type: "union", types, loc: null };
}

export type GInterType = {
  readonly type: "inter";
  readonly types: readonly GType[];
  loc: Location | null;
};

function interType(types: readonly GType[]): GType {
  types = types.filter(t => t.type !== "top");
  if (types.length === 0) return typeBuilder.unknown();
  if (types.length === 1) return types[0];
  return { type: "inter", types, loc: null };
}

export type GRecursiveType = {
  readonly type: "recursive";
  readonly content: GType;
  loc: Location | null;
};

export type GRecursiveVarType = {
  readonly type: "recursive-var";
  readonly defined: () => boolean;
  readonly definition: () => GRecursiveType; // The identity of this function is what distinguishes different variables
  loc: Location | null;
};

function recursiveType(fn: (v: GRecursiveVarType) => GType): GRecursiveType {
  const rec: {
    readonly type: "recursive";
    content: GType | null;
    loc: Location | null;
  } = {
    type: "recursive",
    content: null,
    loc: null,
  };
  const variable: GRecursiveVarType = {
    type: "recursive-var",
    defined: () => rec.content != null,
    definition: () => {
      assertion(rec.content != null);
      return rec as GRecursiveType;
    },
    loc: null,
  };
  rec.content = fn(variable);
  if (!checkGuarded(rec.content, variable)) {
    throw new Error("Unguarded recursive definition");
  }
  return rec as GRecursiveType;
}

export class RecursiveTypeCreator {
  private readonly rec: {
    readonly type: "recursive";
    content: GType | null;
    loc: Location | null;
  } = {
    type: "recursive",
    content: null,
    loc: null,
  };

  private readonly variable: GRecursiveVarType = {
    type: "recursive-var",
    defined: () => this.rec.content != null,
    definition: () => {
      assertion(this.rec.content != null);
      return this.rec as GRecursiveType;
    },
    loc: null,
  };

  private used = false;

  getVar() {
    this.used = true;
    return this.variable;
  }

  create(content: GType) {
    if (this.used) {
      this.rec.content = content;
      if (!checkGuarded(content, this.variable)) {
        throw new Error("Unguarded recursive definition");
      }
      return this.rec as GRecursiveType;
    }
    return content;
  }
}

export const typeBuilder = {
  func: funcType,
  readObject: readObjectType,
  readArray: readArrayType,
  array: arrayType,
  null: nullType,
  string: stringType,
  int: intType,
  bool: boolType,
  union: unionType,
  inter: interType,
  unknown: unknownType,
  never: neverType,
  rec: recursiveType,
};

function checkGuarded(t: GType, v: GRecursiveVarType): boolean {
  switch (t.type) {
    case "func":
    case "readObject":
    case "readArray":
    case "array":
    case "null":
    case "string":
    case "int":
    case "bool":
    case "top":
    case "bot":
      return true;
    case "recursive":
      return checkGuarded(t.content, v);
    case "recursive-var":
      return t.definition !== v.definition;
    case "union":
    case "inter":
      return t.types.every(t => checkGuarded(t, v));
    default:
      never(t);
  }
}
