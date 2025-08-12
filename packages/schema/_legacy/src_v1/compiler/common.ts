export type Schema = {
  type: "Schema";
  types: TypeDeclaration[];
};

export type TypeDeclaration =
  | {
      type: "TypeDeclaration";
      name: string;
      decorators: Decorator[];
      properties: TypeProperty[];
      init: undefined;
    }
  | {
      type: "TypeDeclaration";
      name: string;
      decorators: Decorator[];
      properties: undefined;
      init: Type;
    };

export type TypeProperty = {
  type: "TypeProperty";
  name: string;
  typeSignature: Type;
  decorators: Decorator[];
};

export type Decorator = {
  type: "Decorator";
  name: string;
  arguments: (BooleanNode | NumberNode | StringNode | JsNode)[];
};

export type UnionType = {
  type: "Union";
  type1: Type;
  type2: Type;
};

export type ArrayType = {
  type: "Array";
  type1: Type;
};

export type OptionalType = {
  type: "Optional";
  type1: Type;
};

export type TypeObject = {
  type: "TypeObject";
  decorators: Decorator[];
  properties: TypeProperty[];
};

export type TypeTuple = {
  type: "TypeTuple";
  types: Type[];
};

export type Identifier = {
  type: "Identifier";
  name: string;
};

export type BooleanNode = {
  type: "Boolean";
  raw: string;
};

export type NumberNode = {
  type: "Number";
  raw: string;
};

export type StringNode = {
  type: "String";
  raw: string;
};

export type JsNode = {
  type: "Js";
  raw: string;
};

export type TypeLiteral = NumberNode | StringNode | BooleanNode;

export type TypeNotIdentifier =
  | TypeDeclaration
  | UnionType
  | ArrayType
  | OptionalType
  | TypeObject
  | TypeProperty
  | TypeTuple;

export type Type = TypeNotIdentifier | TypeLiteral | Identifier;

export class Scope {
  map: Map<string, TypeDeclaration>;

  constructor() {
    this.map = new Map();
  }

  bind(name: string, node: TypeDeclaration) {
    const curr = this.map.get(name);
    if (curr) {
      throw new Error(`Duplicate ${name} declaration`);
    }
    this.map.set(name, node);
  }

  get(name: string) {
    return this.map.get(name);
  }

  find(node: Identifier) {
    const curr = this.map.get(node.name);
    if (curr) {
      return curr;
    }
    throw new Error(`${node.name} was not defined`);
  }
}

export class CircularCheck {
  set: WeakSet<TypeNotIdentifier>;

  constructor() {
    this.set = new WeakSet();
  }

  check(node: TypeNotIdentifier) {
    if (this.set.has(node)) {
      throw new Error(`Type refers itself`);
    }
  }

  add(node: TypeNotIdentifier) {
    this.set.add(node);
  }

  remove(node: TypeNotIdentifier) {
    this.set.delete(node);
  }
}

export class TypeInfo {
  id: string;
  map: Map<string, string>;

  constructor(id: string) {
    this.id = id;
    this.map = new Map();
  }

  /* get( name: string ) {
    return this.map.get( name );
  } */

  getForSure(name: string) {
    const value = this.map.get(name);
    /* istanbul ignore if */
    if (value == null) {
      throw new Error("Assertion error");
    }
    return value;
  }

  set(name: string, funId: string) {
    const oldValue = this.map.get(name);
    this.map.set(name, funId);
    return oldValue;
  }

  toCode() {
    let code = "";
    code += `const ${this.id}={\n`;
    for (const [name, funId] of this.map) {
      code += `${name}:${funId},\n`;
    }
    code += `};\n`;
    return code;
  }
}

export type WithScope = {
  // Scope
  scope: Scope;
};

export type Context = WithScope & {
  // To prevent types from refering themselfs
  circular: CircularCheck;
};

export type YargsOptions = {
  alias: { [key: string]: string[] };
  array: (
    | string
    | { key: string; boolean: true }
    | { key: string; number: true }
  )[];
  boolean: string[];
  coerce: { [key: string]: string };
  count: string[];
  string: string[];
  narg: { [key: string]: number };
  number: string[];
};

export type CliContext = WithScope & {
  // The current path
  path: string[];
  // To prevent maximum call stack size exceeded
  stack: Set<TypeNotIdentifier>;
};

export function pad(str: string, length: number) {
  while (str.length < length) {
    str += " ";
  }
  return str;
}
