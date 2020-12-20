import type { Location } from "../runtime/input";

export interface RuleMap {
  seq: SeqRule;
  choice: ChoiceRule;
  repeat: RepeatRule;
  repeat1: Repeat1Rule;
  optional: OptionalRule;
  id: IdRule;
  select: SelectRule;
  empty: EmptyRule;
  eof: EofRule;
  string: StringRule;
  regexp: RegExpRule;
  field: FieldRule;
  action: ActionRule;
  predicate: PredicateRule;
}

export type RuleNames = keyof RuleMap;
export type AnyRule = RuleMap[RuleNames];

export type TokenRules = EofRule | StringRule | RegExpRule;

export type ValueRules = IdRule | SelectRule | EmptyRule | TokenRules;

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
  // TODO readonly arguments: [];
  readonly return: AnyCode | null;
  readonly modifiers: RuleModifiers;
  loc: Location | null;
};

function rule(
  name: string,
  rule: AnyRule,
  modifiers: RuleModifiers,
  returnCode: AnyCode | null
): RuleDeclaration {
  return {
    type: "rule",
    name,
    rule,
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
  readonly parent: ValueRules;
  readonly field: string;
  loc: Location | null;
};

function select(parent: ValueRules, field: string): SelectRule {
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
  readonly rule: ValueRules;
  readonly multiple: boolean;
  loc: Location | null;
};

function field(name: string, rule: ValueRules): FieldRule {
  return {
    type: "field",
    name,
    rule,
    multiple: false,
    loc: null,
  };
}

function fieldMultiple(name: string, rule: ValueRules): FieldRule {
  return {
    type: "field",
    name,
    rule,
    multiple: true,
    loc: null,
  };
}

export type ActionRule = {
  readonly type: "action";
  readonly action: string;
  loc: Location | null;
};

function action(action: string): ActionRule {
  return {
    type: "action",
    action,
    loc: null,
  };
}

export type PredicateRule = {
  readonly type: "predicate";
  readonly predicate: string;
  loc: Location | null;
};

function predicate(predicate: string): PredicateRule {
  return {
    type: "predicate",
    predicate,
    loc: null,
  };
}

function precedenceLeftAssoc(number: number, rule: AnyRule) {
  // TODO https://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl
}

function precedenceRightAssoc(number: number, rule: AnyRule) {
  // TODO https://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl
}

function precedenceDynamic() {
  // TODO https://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl
}

export const builder = {
  rule,
  seq,
  choice,
  repeat,
  repeat1,
  optional,
  id,
  select,
  empty,
  eof,
  string,
  regexp,
  field,
  fieldMultiple,
  action,
  predicate,
};

export type AnyCode = IdCode | SelectCode | ObjectCode;

export type IdCode = {
  readonly type: "id";
  readonly name: string;
};

export type SelectCode = {
  readonly type: "select";
  readonly parent: AnyCode;
  readonly field: string;
};

export type ObjectCode = {
  readonly type: "object";
  readonly fields: readonly (readonly [string, AnyCode])[];
};

export interface CodeMap {
  id: IdCode;
  select: SelectCode;
  object: ObjectCode;
}

export const exprBuilder = {
  id(name: string): IdCode {
    return {
      type: "id",
      name,
    };
  },
  select(parent: AnyCode, field: string): SelectCode {
    return {
      type: "select",
      parent,
      field,
    };
  },
  object(fields: { [key: string]: AnyCode }): ObjectCode {
    return {
      type: "object",
      fields: Object.entries(fields),
    };
  },
};
