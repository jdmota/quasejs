// @flow
import { type Location } from "../../../parser/src/tokenizer";
import type {
  RegExpToken, NumberToken, CharToken, TemplateToken,
  AssignmentOperator, UnaryOperator, UpdateOperator, BinaryOperator
} from "./tokens";

export type Modifiers = { [key: string]: boolean };
export type NodeType =
  "ArrayExpression" |
  "ArrayPattern" |
  "AssignmentExpression" |
  "AssignmentPattern" |
  "AwaitExpression" |
  "BinaryExpression" |
  "BindExpression" |
  "Block" |
  "BooleanLiteral" |
  "Break" |
  "CallExpression" |
  "CatchClause" |
  "CharLiteral" |
  "ClassBody" |
  "ClassExpression" |
  "ConditionalExpression" |
  "Continue" |
  "Debugger" |
  "Decorator" |
  "DoWhile" |
  "ExportDeclaration" |
  "For" |
  "FunctionExpression" |
  "Identifier" |
  "If" |
  "Import" |
  "ImportDeclaration" |
  "Labeled" |
  "MemberExpression" |
  "MetaProperty" |
  "NonNullExpression" |
  "NullLiteral" |
  "NumericLiteral" |
  "ObjectExpression" |
  "ObjectPattern" |
  "ObjectProperty" |
  "OptionalExpression" |
  "Program" |
  "RegExpLiteral" |
  "RestElement" |
  "ReturnExpression" |
  "SequenceExpression" |
  "SpreadElement" |
  "Super" |
  "TaggedTemplateExpression" |
  "TemplateElement" |
  "TemplateLiteral" |
  "ThisExpression" |
  "ThrowExpression" |
  "Try" |
  "UnaryExpression" |
  "UpdateExpression" |
  "VariableDeclaration" |
  "VariableDeclarator" |
  "While" |
  "YieldExpression";

/* eslint no-use-before-define: 0 */

export type Node = {
  loc: Location
} & {
  [key: string]: any
};

export type RegExpLiteral = Node & {
  type: "RegExpLiteral",
  value: RegExpToken
};

export type NumericLiteral = Node & {
  type: "NumericLiteral",
  value: NumberToken
};

export type CharLiteral = Node & {
  type: "CharLiteral",
  value: CharToken
};

export type NullLiteral = Node & {
  type: "NullLiteral"
};

export type BooleanLiteral = Node & {
  type: "BooleanLiteral",
  value: boolean
};

export type Literal =
  RegExpLiteral |
  NumericLiteral |
  CharLiteral |
  NullLiteral |
  BooleanLiteral |
  TemplateLiteral;

export type AssignmentExpression = Node & {
  type: "AssignmentExpression",
  left: IdentifierReference | MemberExpression,
  right: Expression,
  operator: AssignmentOperator
};

export type ConditionalExpression = Node & {
  type: "ConditionalExpression",
  test: Expression,
  consequent: Expression,
  alternate: Expression
};

export type UnaryExpression = Node & {
  type: "UnaryExpression",
  prefix: boolean,
  operator: UnaryOperator,
  argument: Expression
};

export type UpdateExpression = Node & {
  type: "UpdateExpression",
  prefix: boolean,
  operator: UpdateOperator,
  argument: Expression
};

export type BinaryExpression = Node & {
  type: "BinaryExpression",
  left: Expression,
  right: Expression,
  operator: BinaryOperator
};

export type BindExpression = Node & {
  type: "BindExpression",
  object: Expression,
  callee: Expression
};

export type NonNullExpression = Node & {
  type: "NonNullExpression",
  expression: Expression
};

export type TaggedTemplateExpression = Node & {
  type: "TaggedTemplateExpression",
  tag: Expression,
  quasi: TemplateLiteral
};

export type ArrayExpression = Node & {
  type: "ArrayExpression",
  elements: Array<Expression | SpreadElement>
};

export type ObjectExpression = Node & {
  type: "ObjectExpression",
  properties: Array<{ type: "ObjectProperty", key: IdentifierPropKey, value: Expression } | SpreadElement>
};

export type Debugger = Node & {
  type: "Debugger"
};

export type If = Node & {
  type: "If",
  test: Expression,
  consequent: Expression,
  alternate: ?Expression
};

export type While = Node & {
  type: "While",
  test: Expression,
  block: Expression
};

export type For = Node & (
  {
    type: "For",
    await: boolean,
    usedParen: boolean,
    init: VariableDeclaration,
    in: Expression,
    block: Expression
  } |
  {
    type: "For",
    await: boolean,
    usedParen: boolean,
    init: ?VariableDeclaration,
    test: ?Expression,
    update: ?Expression,
    block: Expression
  }
);

export type DoWhile = Node & {
  type: "DoWhile",
  test: Expression,
  body: Expression
};

export type Labeled = Node & {
  type: "Labeled",
  label: IdentifierLabelDefinition,
  loop: For | While | DoWhile
};

export type Break = Node & {
  type: "Break",
  label: ?IdentifierLabelReference
};

export type Continue = Node & {
  type: "Continue",
  label: ?IdentifierLabelReference
};

export type ThisExpression = Node & {
  type: "ThisExpression",
  label: ?IdentifierReference
};

export type OptionalExpression = Node & {
  type: "OptionalExpression",
  argument: Expression
};

export type ReturnExpression = Node & {
  type: "ReturnExpression",
  argument: Expression
};

export type ThrowExpression = Node & {
  type: "ThrowExpression",
  argument: Expression
};

export type AwaitExpression = Node & {
  type: "AwaitExpression",
  argument: Expression
};

export type YieldExpression = Node & {
  type: "YieldExpression",
  argument: Expression
};

export type Super = Node & {
  type: "Super"
};

export type Import = Node & {
  type: "Import"
};

export type Block = Node & {
  type: "Block",
  body: Array<VariableDeclaration | Expression>
};

export type SequenceExpression = Node & {
  type: "SequenceExpression",
  expressions: Array<Expression>
};

export type MetaProperty = Node & {
  type: "MetaProperty",
  meta: IdentifierReserved,
  property: IdentifierPropKey
};

export type Expression =
  AssignmentExpression |
  ConditionalExpression |
  UnaryExpression |
  BinaryExpression |
  UpdateExpression |
  NonNullExpression |
  BindExpression |
  CallExpression |
  MemberExpression |
  TemplateElement |
  TaggedTemplateExpression |
  Literal |
  ArrayExpression |
  ObjectExpression |
  Debugger |
  Labeled |
  If |
  While |
  For |
  DoWhile |
  Continue |
  Break |
  Try |
  ThisExpression |
  OptionalExpression |
  ReturnExpression |
  ThrowExpression |
  AwaitExpression |
  YieldExpression |
  Super |
  Import |
  FunctionExpression |
  ClassExpression |
  Block |
  SequenceExpression |
  IdentifierReference |
  MetaProperty;

export type TypeAnnotation = Expression;

export type CatchClause = Node & {
  type: "CatchClause",
  param: ?BindingAtom,
  body: Expression
};

export type Try = Node & {
  type: "Try",
  body: Expression,
  handler: ?CatchClause,
  finalizer: ?Expression
};

type WithMutable = {
  mutable: ?boolean
};

type WithType = WithMutable & {
  typeAnnotation: ?Expression
};

export type Identifier =
  IdentifierDefinition |
  IdentifierReference |
  IdentifierLabelDefinition |
  IdentifierLabelReference |
  IdentifierPropKey |
  IdentifierReserved;

export type IdentifierDefinition = Node & WithType & {
  type: "Identifier",
  name: string,
  idType: "definition"
};

export type IdentifierReference = Node & {
  type: "Identifier",
  name: string,
  idType: "reference"
};

export type IdentifierLabelDefinition = Node & {
  type: "Identifier",
  name: string,
  idType: "labelDefinition"
};

export type IdentifierLabelReference = Node & {
  type: "Identifier",
  name: string,
  idType: "labelReference"
};

export type IdentifierPropKey = Node & {
  type: "Identifier",
  name: string,
  idType: "propKey"
};

export type IdentifierReserved = Node & {
  type: "Identifier",
  name: string,
  idType: "reserved"
};

export type SpreadElement = Node & {
  type: "SpreadElement",
  argument: Expression
};

export type TemplateElement = Node & {
  type: "TemplateElement",
  value: TemplateToken,
  tail: boolean
};

export type TemplateLiteral = Node & {
  type: "TemplateLiteral",
  expressions: Array<Expression>,
  quasis: Array<TemplateElement>
};

export type ArrayPattern = Node & WithType & {
  type: "ArrayPattern",
  elements: Array<Binding | null>
};

export type ObjectProperty = Node & {
  type: "ObjectProperty",
  key: IdentifierPropKey,
  value: Binding
};

export type ObjectPattern = Node & WithType & {
  type: "ObjectPattern",
  properties: Array<ObjectProperty | RestElement>
};

export type RestElement = Node & WithType & {
  type: "RestElement",
  argument: IdentifierDefinition
};

export type AssignmentPattern = Node & {
  type: "AssignmentPattern",
  left: BindingAtom,
  right: Expression
};

export type BindingAtom = IdentifierDefinition | ObjectPattern | ArrayPattern;

export type Binding = BindingAtom | AssignmentPattern | RestElement;

export type VariableDeclarator = Node & {
  type: "VariableDeclarator",
  id: BindingAtom,
  init: ?Expression,
  modifiers: ?Modifiers
};

export type VariableDeclaration = Node & {
  type: "VariableDeclaration",
  kind: "val" | "var",
  declarations: Array<VariableDeclarator>
};

export type FunctionExpression = Node & {
  type: "FunctionExpression",
  modifiers: ?Modifiers,
  id: ?IdentifierDefinition,
  params: Array<Binding>,
  body: Expression,
  returnType: ?TypeAnnotation
};

export type ClassConstructor = Node & {
  type: "FunctionExpression",
  id: IdentifierDefinition & { name: "init" },
  params: Array<Binding & {
    modifiers: ?Modifiers
  }>,
  body: Expression
};

export type ClassBody = Node & {
  type: "ClassBody",
  body: Array<Declaration | ClassConstructor>
};

export type ClassExpression = Node & {
  type: "ClassExpression",
  modifiers: ?Modifiers,
  id: ?IdentifierDefinition,
  generics: Array<Binding>,
  extends: Array<Expression>,
  body: ClassBody
};

export type Declaration = VariableDeclaration | FunctionExpression | ClassExpression;

export type ExportDeclaration = Node & (
  {
    type: "ExportDeclaration",
    declaration: VariableDeclaration | ( ( FunctionExpression | ClassExpression ) & { id: IdentifierDefinition } )
  } |
  {
    type: "ExportDeclaration",
    object: ObjectExpression
  }
);

export type ImportDeclaration = Node & {
  type: "ImportDeclaration",
  pattern: ?ObjectPattern,
  from: ?TemplateLiteral
};

export type Program = Node & {
  type: "Program",
  body: Array<Expression | VariableDeclaration | ExportDeclaration | ImportDeclaration>
};

export type MemberExpression = Node & (
  {
    type: "MemberExpression",
    object: Expression,
    property: Expression,
    computed: true,
    optional: ?boolean
  } |
  {
    type: "MemberExpression",
    object: Expression,
    property: IdentifierPropKey,
    computed: false,
    optional: ?boolean
  }
);

export type CallExpression = Node & {
  type: "CallExpression",
  callee: Expression,
  arguments: Array<Expression>,
  optional: ?boolean
};

export type Decorator = Node & {
  type: "Decorator",
  expression: IdentifierReference | MemberExpression | CallExpression
};
