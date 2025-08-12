import type { ReadonlyDeep } from "type-fest";

export type Expr = LetDecl | Id | Application | FuncExpr | Types;

export type TypesMap = Readonly<{
  object: ObjType;
  tuple: TupleType;
  array: ArrayType;
  func: FuncType;
  union: UnionType;
  inter: IntersectionType;
}>;

export type Types = TypesMap[keyof TypesMap];

export type File = ReadonlyDeep<{
  tag: "file";
  imports: string[];
  declarations: Expr[];
}>;

export type LetDecl = ReadonlyDeep<{
  tag: "let";
  name: string;
  type: Expr;
  expr: Expr;
}>;

export type Id = ReadonlyDeep<{
  tag: "id";
  name: string;
}>;

export type Application = ReadonlyDeep<{
  tag: "application";
  expr: Expr;
  arguments: Expr[];
}>;

export type FuncArg = ReadonlyDeep<{
  tag: "funcArg";
  name: string;
  type: Expr | null;
}>;

export type FuncExpr = ReadonlyDeep<{
  tag: "func";
  body: Expr[];
  arguments: FuncArg[];
}>;

export type ObjFieldType = ReadonlyDeep<{
  tag: "objFieldType";
  name: string;
  expr: Expr;
  mutable: boolean;
}>;

export type ObjType = ReadonlyDeep<{
  tag: "objectType";
  fields: ObjFieldType[];
}>;

export type TupleFieldType = ReadonlyDeep<{
  tag: "tupleFieldType";
  name: string | null;
  expr: Expr;
  mutable: boolean;
}>;

export type TupleType = ReadonlyDeep<{
  tag: "tupleType";
  items: TupleFieldType[];
}>;

export type ArrayType = ReadonlyDeep<{
  tag: "arrayType";
  itemType: Expr;
  mutable: boolean;
}>;

export type FuncType = ReadonlyDeep<{
  tag: "funcType";
  arguments: Expr[];
  return: Expr;
}>;

export type UnionType = ReadonlyDeep<{
  tag: "unionType";
  left: Expr;
  right: Expr;
}>;

export type IntersectionType = ReadonlyDeep<{
  tag: "intersectionType";
  left: Expr;
  right: Expr;
}>;
