import type { Location } from "../runtime/input";
import { never } from "../utils";
import { LocalsCollector } from "./grammar-visitors";

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
  object: ObjectRule;
  int: IntRule;
  id: IdRule;
  select: SelectRule;
  call: CallRule;
  call2: Call2Rule;
  predicate: PredicateRule;
  field: FieldRule;
}

export type Declaration = RuleDeclaration | TokenDeclaration;

export type References = CallRule | IdRule;

export type RuleNames = keyof RuleMap;
export type AnyRule = RuleMap[RuleNames];

export type TokenRules = EofRule | StringRule | RegExpRule;

export type ExprRule = IdRule | SelectRule | ObjectRule | IntRule | Call2Rule;

export type Assignables = TokenRules | CallRule | ExprRule;

export type RuleModifiers = {
  readonly start?: boolean;
  readonly noSkips?: boolean;
  readonly inline?: boolean;
};

export type RuleDeclaration = {
  readonly type: "rule";
  readonly name: string;
  readonly rule: AnyRule;
  readonly args: readonly string[];
  readonly return: ExprRule;
  readonly modifiers: RuleModifiers;
  readonly locals: readonly string[];
  loc: Location | null;
};

function rule(
  name: string,
  rule: AnyRule,
  args: readonly string[],
  modifiers: RuleModifiers,
  returnCode: ExprRule | null
): RuleDeclaration {
  const locals = new LocalsCollector().run(rule);
  return {
    type: "rule",
    name,
    rule,
    args,
    modifiers,
    return: returnCode ?? builder.object(locals.map(l => [l, builder.id(l)])),
    locals,
    loc: null,
  };
}

export type TokenModifiers = {
  readonly type: "normal" | "skip" | "fragment";
};

export type TokenDeclaration = {
  readonly type: "token";
  readonly name: string;
  readonly rule: AnyRule;
  readonly return: ExprRule;
  readonly modifiers: TokenModifiers;
  readonly locals: readonly string[];
  loc: Location | null;
};

function token(
  name: string,
  rule: AnyRule,
  modifiers: TokenModifiers,
  returnCode: ExprRule | null
): TokenDeclaration {
  const locals = new LocalsCollector().run(rule);
  return {
    type: "token",
    name,
    rule,
    modifiers,
    return: returnCode ?? builder.object(locals.map(l => [l, builder.id(l)])),
    locals,
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
  readonly args: readonly ExprRule[];
  loc: Location | null;
};

function call(id: string, args: readonly ExprRule[]): CallRule {
  return {
    type: "call",
    id,
    args,
    loc: null,
  };
}

export type Call2Rule = {
  readonly type: "call2";
  readonly id: string;
  readonly args: readonly ExprRule[];
  loc: Location | null;
};

function call2(id: string, args: readonly ExprRule[]): Call2Rule {
  return {
    type: "call2",
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
  readonly parent: ExprRule;
  readonly field: string;
  loc: Location | null;
};

function select(parent: ExprRule, field: string): SelectRule {
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
  readonly code: ExprRule;
  loc: Location | null;
};

function predicate(code: ExprRule): PredicateRule {
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

export type IntRule = {
  readonly type: "int";
  readonly value: number;
  loc: Location | null;
};

function int(value: number): IntRule {
  return {
    type: "int",
    value,
    loc: null,
  };
}

export type ObjectRule = {
  readonly type: "object";
  readonly fields: readonly (readonly [string, ExprRule])[];
  loc: Location | null;
};

function object(fields: readonly (readonly [string, ExprRule])[]): ObjectRule {
  return {
    type: "object",
    fields,
    loc: null,
  };
}

export const builder = {
  rule,
  token,
  seq,
  choice,
  repeat,
  repeat1,
  optional,
  call,
  call2,
  id,
  select,
  empty,
  eof,
  string,
  regexp,
  int,
  object,
  field,
  fieldMultiple,
  predicate,
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
    case "int":
      return value1.type === value2.type && value1.value === value2.value;
    case "call":
    case "call2":
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
    case "eof":
      return value1.type === value2.type;
    case "object":
      if (
        value1.type === value2.type &&
        value1.fields.length === value2.fields.length
      ) {
        for (let i = 0; i < value1.fields.length; i++) {
          const field1 = value1.fields[i];
          const field2 = value2.fields[i];
          if (
            field1[0] !== field2[0] ||
            !sameAssignable(field1[1], field2[1])
          ) {
            return false;
          }
        }
        return true;
      }
      return false;
    default:
      never(value1);
  }
}

export function sameArgs(
  args1: readonly ExprRule[],
  args2: readonly ExprRule[]
) {
  if (args1 === args2) {
    return true;
  }
  if (args1.length !== args2.length) {
    return false;
  }
  for (let i = 0; i < args1.length; i++) {
    if (!sameAssignable(args1[i], args2[i])) {
      return false;
    }
  }
  return true;
}
