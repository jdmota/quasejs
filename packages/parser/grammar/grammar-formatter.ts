import type {
  RuleMap,
  CallRule,
  ChoiceRule,
  EmptyRule,
  EofRule,
  FieldRule,
  IdRule,
  OptionalRule,
  PredicateRule,
  RegExpRule,
  Repeat1Rule,
  RepeatRule,
  SeqRule,
  StringRule,
  AnyRule,
  Call2Rule,
  ObjectRule,
  IntRule,
  BoolRule,
  NullRule,
} from "./grammar-builder.ts";

type IGrammarFormatter = {
  [key in keyof RuleMap]: (node: RuleMap[key]) => string;
};

export class GrammarFormatter implements IGrammarFormatter {
  seq(node: SeqRule) {
    return node.rules.map(r => this.visit(r)).join(" ");
  }

  choice(node: ChoiceRule) {
    return `(${node.rules.map(r => this.visit(r)).join(" | ")})`;
  }

  repeat(node: RepeatRule) {
    return `(${this.visit(node.rule)})*`;
  }

  repeat1(node: Repeat1Rule) {
    return `(${this.visit(node.rule)})+`;
  }

  optional(node: OptionalRule) {
    return `(${this.visit(node.rule)})?`;
  }

  empty(node: EmptyRule) {
    return "";
  }

  eof(node: EofRule) {
    return "eof";
  }

  null(node: NullRule) {
    return "null";
  }

  string(node: StringRule) {
    return JSON.stringify(node.string);
  }

  regexp(node: RegExpRule) {
    return node.regexp;
  }

  object(node: ObjectRule) {
    return `{ ${node.fields
      .map(([k, v]) => `${k}: ${this.visit(v)}`)
      .join(", ")} }`;
  }

  id(node: IdRule) {
    return node.id;
  }

  int(node: IntRule) {
    return node.value + "";
  }

  bool(node: BoolRule) {
    return node.value + "";
  }

  call2(node: Call2Rule) {
    return `@${node.id}(${node.args.map(a => this.visit(a)).join(", ")})`;
  }

  call(node: CallRule) {
    return `${node.id}(${node.args.map(a => this.visit(a)).join(", ")})`;
  }

  field(node: FieldRule) {
    if (node.multiple) {
      return `${node.name} += ${this.visit(node.rule)};`;
    }
    return `${node.name} = ${this.visit(node.rule)};`;
  }

  predicate(node: PredicateRule) {
    return `{${this.visit(node.code)}}?`;
  }

  visit(node: AnyRule): string {
    return this[node.type](node as any);
  }
}
