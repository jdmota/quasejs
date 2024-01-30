import type { Location } from "../runtime/input";
import { never } from "../utils";

// Build rules and expressions

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
  bool: BoolRule;
  id: IdRule;
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

export type ExprRule = IdRule | ObjectRule | IntRule | BoolRule | Call2Rule;

export type Assignables = TokenRules | CallRule | ExprRule;

export type RuleModifiers = {
  readonly start?: boolean;
};

export type RuleDeclaration = {
  readonly type: "rule";
  readonly name: string;
  readonly rule: AnyRule;
  readonly args: readonly RuleDeclarationArg[];
  readonly return: ExprRule | null;
  readonly modifiers: RuleModifiers;
  loc: Location | null;
};

export type RuleDeclarationArg = {
  readonly type: "ruleArg";
  readonly arg: string;
  loc: Location | null;
};

function ruleArg(arg: string): RuleDeclarationArg {
  return {
    type: "ruleArg",
    arg,
    loc: null,
  };
}

function rule(
  name: string,
  rule: AnyRule,
  args: readonly RuleDeclarationArg[],
  modifiers: RuleModifiers,
  returnCode: ExprRule | null = null
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

rule.arg = ruleArg;

export type TokenModifiers = {
  readonly type: "normal" | "skip" | "fragment";
  readonly channels?: readonly string[];
};

export type TokenDeclaration = {
  readonly type: "token";
  readonly name: string;
  readonly rule: AnyRule;
  readonly args: readonly RuleDeclarationArg[];
  readonly return: ExprRule | null;
  readonly modifiers: TokenModifiers;
  loc: Location | null;
};

function token(
  name: string,
  rule: AnyRule,
  args: readonly RuleDeclarationArg[],
  modifiers: TokenModifiers,
  returnCode: ExprRule | null = null
): TokenDeclaration {
  return {
    type: "token",
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

export type BoolRule = {
  readonly type: "bool";
  readonly value: boolean;
  loc: Location | null;
};

function bool(value: boolean): BoolRule {
  return {
    type: "bool",
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
  empty,
  eof,
  string,
  regexp,
  bool,
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
    case "bool":
      return value1.type === value2.type && value1.value === value2.value;
    case "call":
    case "call2":
      return (
        value1.type === value2.type &&
        value1.id === value2.id &&
        sameArgs(value1.args, value2.args)
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

type ICloner = {
  [key in keyof RuleMap]: (node: RuleMap[key]) => RuleMap[key];
};

const cloneRulesVisitor: ICloner = {
  seq(node: SeqRule) {
    return builder.seq(...node.rules.map(r => cloneRules(r)));
  },

  choice(node: ChoiceRule) {
    return builder.choice(...node.rules.map(r => cloneRules(r)));
  },

  repeat(node: RepeatRule) {
    return builder.repeat(cloneRules(node.rule));
  },

  repeat1(node: Repeat1Rule) {
    return builder.repeat1(cloneRules(node.rule));
  },

  optional(node: OptionalRule) {
    return builder.optional(cloneRules(node.rule));
  },

  empty(node: EmptyRule) {
    return builder.empty();
  },

  eof(node: EofRule) {
    return builder.eof();
  },

  string(node: StringRule) {
    return builder.string(node.string);
  },

  regexp(node: RegExpRule) {
    return builder.regexp(node.regexp);
  },

  int(node: IntRule) {
    return builder.int(node.value);
  },

  bool(node: BoolRule) {
    return builder.bool(node.value);
  },

  object(node: ObjectRule) {
    return builder.object(
      node.fields.map(([key, value]) => [key, cloneRules(value)] as const)
    );
  },

  id(node: IdRule) {
    return builder.id(node.id);
  },

  call(node: CallRule) {
    return builder.call(
      node.id,
      node.args.map(a => cloneRules(a))
    );
  },

  call2(node: Call2Rule) {
    return builder.call2(
      node.id,
      node.args.map(a => cloneRules(a))
    );
  },

  field(node: FieldRule) {
    return node.multiple
      ? builder.fieldMultiple(node.name, cloneRules(node.rule))
      : builder.field(node.name, cloneRules(node.rule));
  },

  predicate(node: PredicateRule) {
    return builder.predicate(cloneRules(node.code));
  },
};

function setLoc<T extends { loc: Location | null }>(
  rule: T,
  loc: Location | null
) {
  rule.loc = loc;
  return rule;
}

function cloneRules<T extends AnyRule>(rule: T): T {
  return setLoc(cloneRulesVisitor[rule.type](rule as any) as T, rule.loc);
}

export function cloneRuleDeclaration(decl: RuleDeclaration): RuleDeclaration {
  return setLoc(
    builder.rule(
      decl.name,
      cloneRules(decl.rule),
      decl.args.map(a => setLoc(builder.rule.arg(a.arg), a.loc)),
      decl.modifiers,
      decl.return ? cloneRules(decl.return) : null
    ),
    decl.loc
  );
}

export function cloneTokenDeclaration(
  decl: TokenDeclaration
): TokenDeclaration {
  return setLoc(
    builder.token(
      decl.name,
      cloneRules(decl.rule),
      decl.args.map(a => setLoc(builder.rule.arg(a.arg), a.loc)),
      decl.modifiers,
      decl.return ? cloneRules(decl.return) : null
    ),
    decl.loc
  );
}
