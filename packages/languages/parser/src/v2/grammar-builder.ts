export type FieldRules = FieldRule | FieldMultipleRule;

export type ValueRules = IdRule | EmptyRule | EofRule | StringRule | RegExpRule;

export type NamedRule = {
  name: string;
  rule: Rule;
};

export type Rule =
  | SeqRule
  | ChoiceRule
  | RepeatRule
  | Repeat1Rule
  | OptionalRule
  | IdRule
  | EmptyRule
  | EofRule
  | StringRule
  | RegExpRule
  | FieldRules;

export type SeqRule = {
  readonly type: "seq";
  readonly rules: Rule[];
};

function seq(...rules: Rule[]): SeqRule {
  return {
    type: "seq",
    rules,
  };
}

export type ChoiceRule = {
  readonly type: "choice";
  readonly rules: Rule[];
};

function choice(...rules: Rule[]): ChoiceRule {
  return {
    type: "choice",
    rules,
  };
}

export type RepeatRule = {
  readonly type: "repeat";
  readonly rule: Rule;
};

function repeat(rule: Rule): RepeatRule {
  return {
    type: "repeat",
    rule,
  };
}

export type Repeat1Rule = {
  readonly type: "repeat1";
  readonly rule: Rule;
};

function repeat1(rule: Rule): Repeat1Rule {
  return {
    type: "repeat1",
    rule,
  };
}

export type OptionalRule = {
  readonly type: "optional";
  readonly rule: Rule;
};

function optional(rule: Rule): OptionalRule {
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
  readonly regexp: RegExp;
};

function regexp(regexp: RegExp): RegExpRule {
  return {
    type: "regexp",
    regexp,
  };
}

export type FieldRule = {
  readonly type: "field";
  readonly name: string;
  readonly rule: ValueRules;
};

function field(name: string, rule: ValueRules): FieldRule {
  return {
    type: "field",
    name,
    rule,
  };
}

export type FieldMultipleRule = {
  readonly type: "field_multiple";
  readonly name: string;
  readonly rule: ValueRules;
};

function fieldMultiple(name: string, rule: ValueRules): FieldMultipleRule {
  return {
    type: "field_multiple",
    name,
    rule,
  };
}

function action() {
  // TODO
}

function precedenceLeftAssoc(number: number, rule: Rule) {
  // TODO https://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl
}

function precedenceRightAssoc(number: number, rule: Rule) {
  // TODO https://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl
}

function precedenceDynamic() {
  // TODO https://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl
}

export const builder = {
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
};
