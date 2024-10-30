export type Expr = LetDecl | Id | Application | FuncExpr | Types;

export type Types =
  | ObjType
  | TupleType
  | ArrayType
  | OptionalType
  | UnionType
  | FuncType;

export type File = {
  tag: "file";
  imports: string[];
  declarations: Expr[];
};

export type LetDecl = {
  tag: "let";
  name: string;
  type: Expr;
  expr: Expr;
};

export type Id = {
  tag: "id";
  name: string;
};

export type Application = {
  tag: "application";
  expr: Expr;
  arguments: Expr[];
};

export type FuncExpr = {
  tag: "func";
  body: Expr[];
  arguments: [string, Expr][];
};

export type ObjType = {
  tag: "objectType";
  // name, type, mutable
  fields: [string, Expr, boolean][];
};

export type TupleType = {
  tag: "tupleType";
  // name (for TS), type, mutable
  items: [string | null, Expr, boolean][];
};

export type ArrayType = {
  tag: "arrayType";
  itemType: Expr;
  mutable: boolean;
};

export type OptionalType = {
  tag: "optionalType";
  itemType: Expr;
};

export type UnionType = {
  tag: "unionType";
  left: Expr;
  right: Expr;
};

export type FuncType = {
  tag: "funcType";
  arguments: Expr[];
  return: Expr;
};
