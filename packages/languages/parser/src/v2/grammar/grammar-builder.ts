export interface RuleMap {
  seq: SeqRule;
  choice: ChoiceRule;
  repeat: RepeatRule;
  repeat1: Repeat1Rule;
  optional: OptionalRule;
  id: IdRule;
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

export type ValueRules = IdRule | EmptyRule | TokenRules;

export type RuleModifiers = {
  readonly start: boolean;
  readonly inline: boolean;
  readonly noSkips: boolean;
  readonly skip: boolean;
};

export type RuleDeclaration = {
  readonly type: "rule";
  readonly name: string;
  readonly rule: AnyRule;
  // TODO readonly arguments: [];
  // TODO readonly return: null;
  readonly modifiers: RuleModifiers;
};

function rule(
  name: string,
  rule: AnyRule,
  modifiers: RuleModifiers
): RuleDeclaration {
  return {
    type: "rule",
    name,
    rule,
    modifiers,
  };
}

export type SeqRule = {
  readonly type: "seq";
  readonly rules: AnyRule[];
};

function seq(...rules: AnyRule[]): SeqRule {
  return {
    type: "seq",
    rules,
  };
}

export type ChoiceRule = {
  readonly type: "choice";
  readonly rules: AnyRule[];
};

function choice(...rules: AnyRule[]): ChoiceRule {
  return {
    type: "choice",
    rules,
  };
}

export type RepeatRule = {
  readonly type: "repeat";
  readonly rule: AnyRule;
};

function repeat(rule: AnyRule): RepeatRule {
  return {
    type: "repeat",
    rule,
  };
}

export type Repeat1Rule = {
  readonly type: "repeat1";
  readonly rule: AnyRule;
};

function repeat1(rule: AnyRule): Repeat1Rule {
  return {
    type: "repeat1",
    rule,
  };
}

export type OptionalRule = {
  readonly type: "optional";
  readonly rule: AnyRule;
};

function optional(rule: AnyRule): OptionalRule {
  return {
    type: "optional",
    rule,
  };
}

export type IdRule = {
  readonly type: "id";
  readonly id: string;
};

function id(id: string): IdRule {
  return {
    type: "id",
    id,
  };
}

export type EmptyRule = {
  readonly type: "empty";
};

function empty(): EmptyRule {
  return {
    type: "empty",
  };
}

export type EofRule = {
  readonly type: "eof";
};

function eof(): EofRule {
  return {
    type: "eof",
  };
}

export type StringRule = {
  readonly type: "string";
  readonly string: string;
};

function string(string: string): StringRule {
  return {
    type: "string",
    string,
  };
}

export type RegExpRule = {
  readonly type: "regexp";
  readonly regexp: string;
};

function regexp(regexp: string): RegExpRule {
  return {
    type: "regexp",
    regexp,
  };
}

export type FieldRule = {
  readonly type: "field";
  readonly name: string;
  readonly rule: ValueRules;
  readonly multiple: boolean;
};

function field(name: string, rule: ValueRules): FieldRule {
  return {
    type: "field",
    name,
    rule,
    multiple: false,
  };
}

function fieldMultiple(name: string, rule: ValueRules): FieldRule {
  return {
    type: "field",
    name,
    rule,
    multiple: true,
  };
}

export type ActionRule = {
  readonly type: "action";
  readonly action: string;
};

function action(action: string): ActionRule {
  return {
    type: "action",
    action,
  };
}

export type PredicateRule = {
  readonly type: "predicate";
  readonly predicate: string;
};

function predicate(predicate: string): PredicateRule {
  return {
    type: "predicate",
    predicate,
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
  empty,
  eof,
  string,
  regexp,
  field,
  fieldMultiple,
  action,
  predicate,
};
