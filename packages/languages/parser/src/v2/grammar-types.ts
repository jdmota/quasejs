type AstTypeObject = {
  readonly type: "object";
  readonly name: string;
  readonly fields: ReadonlyMap<string, AstType>;
};

type AstTypeArray = {
  readonly type: "array";
  readonly item: AstType;
};

type AstTypeTuple = {
  readonly type: "tuple";
  readonly items: readonly AstType[];
};

type AstTypeUnion = {
  readonly type: "union";
  readonly items: readonly AstType[];
};

type AstTypeNull = {
  readonly type: "null";
};

type AstTypeNever = {
  readonly type: "never";
};

type AstTypeToken = {
  readonly type: "token";
};

type AstTypeId = {
  readonly type: "id";
  readonly id: string;
};

type AstTypeMember = {
  readonly type: "member";
  readonly parent: AstType;
  readonly id: string;
};

export type AstType =
  | AstTypeObject
  | AstTypeArray
  | AstTypeUnion
  | AstTypeTuple
  | AstTypeNull
  | AstTypeToken
  | AstTypeId
  | AstTypeMember
  | AstTypeNever;

export type AstFields = ReadonlyMap<string, AstType>;

export const astTypeNull: AstTypeNull = {
  type: "null",
};

export const astTypeNever: AstTypeNever = {
  type: "never",
};

export const emptyAstFields: AstFields = new Map<string, AstType>();

export function makeUnion(types: readonly AstType[]): AstType {
  const set = new Set<AstType>(types);
  set.delete(astTypeNever);
  const items = Array.from(set);
  switch (set.size) {
    case 0:
      return astTypeNever;
    case 1:
      return items[0];
    default:
      return {
        type: "union",
        items,
      };
  }
}

export function isArray(ast: AstType): boolean {
  switch (ast.type) {
    case "never":
    case "array":
      return true;
    case "tuple":
    case "object":
    case "token":
    case "id":
    case "member": // TODO maybe?
    case "null":
      return false;
    case "union":
      return ast.items.every(isSpreadable);
  }
}

export function isSpreadable(ast: AstType): boolean {
  switch (ast.type) {
    case "never":
    case "array":
    case "tuple":
      return true;
    case "object":
    case "token":
    case "id":
    case "member": // TODO maybe?
    case "null":
      return false;
    case "union":
      return ast.items.every(isSpreadable);
  }
}

export function getSpreadableItem(ast: AstType): AstType {
  switch (ast.type) {
    case "tuple":
      return makeUnion(ast.items);
    case "array":
      return ast.item;
    case "never":
    case "object":
    case "token":
    case "id":
    case "member": // TODO maybe?
    case "null":
      return astTypeNever;
    case "union":
      return makeUnion(ast.items.map(getSpreadableItem));
  }
}

export function mergeAstFields(a: AstFields, b: AstFields): AstFields {
  const fields = new Map<string, AstType>(a);
  for (const [name, field] of b) {
    const other = fields.get(name) || astTypeNull;
    fields.set(name, makeUnion([field, other]));
  }
  return fields;
}

export function astFieldsToAstTypeObject(
  name: string,
  fields: AstFields
): AstTypeObject {
  return {
    type: "object",
    name,
    fields,
  };
}

export function astTypeToString(ast: AstType): string {
  switch (ast.type) {
    case "tuple":
      return `[${ast.items.map(astTypeToString).join(", ")}]`;
    case "array":
      return `${astTypeToString(ast.item)}[]`;
    case "never":
      return `never`;
    case "object":
      return `{ type: ${JSON.stringify(ast.name)} }`;
    case "token":
      return `token`;
    case "id":
      return `Rule${ast.id}`;
    case "member":
      return `${astTypeToString(ast.parent)}.${ast.id}`;
    case "null":
      return `null`;
    case "union":
      return `${ast.items.map(astTypeToString).join(" | ")}`;
  }
}

export function astFieldsToString(fields: AstFields): string {
  return `{${Array.from(fields)
    .map(([name, field]) => `${name}: ${astTypeToString(field)}`)
    .join(", ")}}`;
}
