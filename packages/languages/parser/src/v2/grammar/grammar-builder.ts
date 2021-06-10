import type { Location } from "../runtime/input";
import { never } from "../utils";

export interface RuleMap {
  seq: SeqRule;
  choice: ChoiceRule;
  repeat: RepeatRule;
  repeat1: Repeat1Rule;
  optional: OptionalRule;
  empty: EmptyRule;
  eof: EofRule;
  string: StringRule;
  regexp: RegExpRule;
  id: IdRule;
  select: SelectRule;
  call: CallRule;
  predicate: PredicateRule;
  field: FieldRule;
  action: ActionRule;
}

export type RuleNames = keyof RuleMap;
export type AnyRule = RuleMap[RuleNames];

export interface ExprMap {
  id: IdExpr;
  select: SelectExpr;
  call: CallExpr;
  object: ObjectExpr;
  field: FieldExpr;
}

export type ExprNames = keyof ExprMap;
export type AnyExpr = ExprMap[ExprNames];

export type TokenRules = EofRule | StringRule | RegExpRule;

export type Assignables =
  | EmptyRule
  | TokenRules
  | IdRule
  | SelectRule
  | CallRule;

export type RuleModifiers = {
  readonly start?: boolean;
  readonly inline?: boolean;
  readonly noSkips?: boolean;
  readonly skip?: boolean;
};

export type RuleDeclaration = {
  readonly type: "rule";
  readonly name: string;
  readonly rule: AnyRule;
  readonly args: readonly string[];
  readonly return: AnyExpr | null;
  readonly modifiers: RuleModifiers;
  loc: Location | null;
};

function rule(
  name: string,
  rule: AnyRule,
  args: readonly string[],
  modifiers: RuleModifiers,
  returnCode: AnyExpr | null
): RuleDeclaration {
  return {
    type: "rule",
    name,
    rule,
    args,
    modifiers,
    return: returnCode,
    loc: null,
  };
}

export type SeqRule = {
  readonly type: "seq";
  readonly rules: AnyRule[];
  loc: Location | null;
};

function seq(...rules: AnyRule[]): SeqRule {
  return {
    type: "seq",
    rules,
    loc: null,
  };
}

export type ChoiceRule = {
  readonly type: "choice";
  readonly rules: AnyRule[];
  loc: Location | null;
};

function choice(...rules: AnyRule[]): ChoiceRule {
  return {
    type: "choice",
    rules,
    loc: null,
  };
}

export type RepeatRule = {
  readonly type: "repeat";
  readonly rule: AnyRule;
  loc: Location | null;
};

function repeat(rule: AnyRule): RepeatRule {
  return {
    type: "repeat",
    rule,
    loc: null,
  };
}

export type Repeat1Rule = {
  readonly type: "repeat1";
  readonly rule: AnyRule;
  loc: Location | null;
};

function repeat1(rule: AnyRule): Repeat1Rule {
  return {
    type: "repeat1",
    rule,
    loc: null,
  };
}

export type OptionalRule = {
  readonly type: "optional";
  readonly rule: AnyRule;
  loc: Location | null;
};

function optional(rule: AnyRule): OptionalRule {
  return {
    type: "optional",
    rule,
    loc: null,
  };
}

export type CallRule = {
  readonly type: "call";
  readonly id: string;
  readonly args: readonly AnyExpr[];
  loc: Location | null;
};

function call(id: string, args: readonly AnyExpr[]): CallRule {
  return {
    type: "call",
    id,
    args,
    loc: null,
  };
}

export type IdRule = {
  readonly type: "id";
  readonly id: string;
  loc: Location | null;
};

function id(id: string): IdRule {
  return {
    type: "id",
    id,
    loc: null,
  };
}

export type SelectRule = {
  readonly type: "select";
  readonly parent: Assignables;
  readonly field: string;
  loc: Location | null;
};

function select(parent: Assignables, field: string): SelectRule {
  return {
    type: "select",
    parent,
    field,
    loc: null,
  };
}

export type EmptyRule = {
  readonly type: "empty";
  loc: Location | null;
};

function empty(): EmptyRule {
  return {
    type: "empty",
    loc: null,
  };
}

export type EofRule = {
  readonly type: "eof";
  loc: Location | null;
};

function eof(): EofRule {
  return {
    type: "eof",
    loc: null,
  };
}

export type StringRule = {
  readonly type: "string";
  readonly string: string;
  loc: Location | null;
};

function string(string: string): StringRule {
  return {
    type: "string",
    string,
    loc: null,
  };
}

export type RegExpRule = {
  readonly type: "regexp";
  readonly regexp: string;
  loc: Location | null;
};

function regexp(regexp: string): RegExpRule {
  return {
    type: "regexp",
    regexp,
    loc: null,
  };
}

export type FieldRule = {
  readonly type: "field";
  readonly name: string;
  readonly rule: Assignables;
  readonly multiple: boolean;
  loc: Location | null;
};

function field(name: string, rule: Assignables): FieldRule {
  return {
    type: "field",
    name,
    rule,
    multiple: false,
    loc: null,
  };
}

function fieldMultiple(name: string, rule: Assignables): FieldRule {
  return {
    type: "field",
    name,
    rule,
    multiple: true,
    loc: null,
  };
}

export type PredicateRule = {
  readonly type: "predicate";
  readonly code: AnyExpr;
  loc: Location | null;
};

function predicate(code: AnyExpr): PredicateRule {
  return {
    type: "predicate",
    code,
    loc: null,
  };
}

function precedenceLeftAssoc(number: number, rule: AnyRule) {
  // TODO https://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl
}

function precedenceRightAssoc(number: number, rule: AnyRule) {
  // TODO https://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl
}

export type ActionRule = {
  readonly type: "action";
  readonly code: AnyExpr;
  loc: Location | null;
};

function action(code: AnyExpr): ActionRule {
  return {
    type: "action",
    code,
    loc: null,
  };
}

export type IdExpr = {
  readonly type: "idExpr";
  readonly id: string;
  loc: Location | null;
};

function idExpr(id: string): IdExpr {
  return {
    type: "idExpr",
    id,
    loc: null,
  };
}

export type SelectExpr = {
  readonly type: "selectExpr";
  readonly parent: AnyExpr;
  readonly field: string;
  loc: Location | null;
};

function selectExpr(parent: AnyExpr, field: string): SelectExpr {
  return {
    type: "selectExpr",
    parent,
    field,
    loc: null,
  };
}

export type ObjectExpr = {
  readonly type: "objectExpr";
  readonly fields: readonly (readonly [string, AnyExpr])[];
};

function objectExpr(fields: { [key: string]: AnyExpr }): ObjectExpr {
  return {
    type: "objectExpr",
    fields: Object.entries(fields),
  };
}

export type CallExpr = {
  readonly type: "callExpr";
  readonly id: string;
  readonly args: readonly AnyExpr[];
  loc: Location | null;
};

function callExpr(id: string, args: readonly AnyExpr[]): CallExpr {
  return {
    type: "callExpr",
    id,
    args,
    loc: null,
  };
}

export type FieldExpr = {
  readonly type: "fieldExpr";
  readonly name: string;
  readonly expr: AnyExpr;
  readonly multiple: boolean;
  loc: Location | null;
};

function fieldExpr(name: string, expr: AnyExpr): FieldExpr {
  return {
    type: "fieldExpr",
    name,
    expr,
    multiple: false,
    loc: null,
  };
}

function fieldMultipleExpr(name: string, expr: AnyExpr): FieldExpr {
  return {
    type: "fieldExpr",
    name,
    expr,
    multiple: true,
    loc: null,
  };
}

export const builder = {
  // Rules
  rule,
  seq,
  choice,
  repeat,
  repeat1,
  optional,
  call,
  id,
  select,
  empty,
  eof,
  string,
  regexp,
  field,
  fieldMultiple,
  predicate,
  action,
  // Expressions
  idExpr,
  selectExpr,
  objectExpr,
  callExpr,
  fieldExpr,
  fieldMultipleExpr,
};

// Utils

export function sameAssignable(
  value1: Assignables,
  value2: Assignables
): boolean {
  if (value1 === value2) {
    return true;
  }
  switch (value1.type) {
    case "string":
      return value1.type === value2.type && value1.string === value2.string;
    case "regexp":
      return value1.type === value2.type && value1.regexp === value2.regexp;
    case "id":
      return value1.type === value2.type && value1.id === value2.id;
    case "call":
      return (
        value1.type === value2.type &&
        value1.id === value2.id &&
        sameArgs(value1.args, value2.args)
      );
    case "select":
      return (
        value1.type === value2.type &&
        value1.field === value2.field &&
        sameAssignable(value1.parent, value2.parent)
      );
    case "empty":
    case "eof":
      return value1.type === value2.type;
    default:
      return never(value1);
  }
}

export function sameExpr(value1: AnyExpr, value2: AnyExpr): boolean {
  if (value1 === value2) {
    return true;
  }
  switch (value1.type) {
    case "idExpr":
      return value1.type === value2.type && value1.id === value2.id;
    case "callExpr":
      return (
        value1.type === value2.type &&
        value1.id === value2.id &&
        sameArgs(value1.args, value2.args)
      );
    case "selectExpr":
      return (
        value1.type === value2.type &&
        value1.field === value2.field &&
        sameExpr(value1.parent, value2.parent)
      );
    case "objectExpr":
      if (
        value1.type === value2.type &&
        value1.fields.length === value2.fields.length
      ) {
        for (let i = 0; i < value1.fields.length; i++) {
          const field1 = value1.fields[i];
          const field2 = value2.fields[i];
          if (field1[0] !== field2[0] || !sameExpr(field1[1], field2[1])) {
            return false;
          }
        }
        return true;
      }
      return false;
    case "fieldExpr":
      return (
        value1.type === value2.type &&
        value1.name === value2.name &&
        value1.multiple === value2.multiple &&
        sameExpr(value1.expr, value2.expr)
      );
    default:
      return never(value1);
  }
}

export function sameArgs(args1: readonly AnyExpr[], args2: readonly AnyExpr[]) {
  if (args1 === args2) {
    return true;
  }
  if (args1.length !== args2.length) {
    return false;
  }
  for (let i = 0; i < args1.length; i++) {
    if (!sameExpr(args1[i], args2[i])) {
      return false;
    }
  }
  return true;
}
