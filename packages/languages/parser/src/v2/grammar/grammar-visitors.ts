import {
  AugmentedDeclaration,
  AugmentedRuleDeclaration,
  AugmentedTokenDeclaration,
} from "./grammar.ts";
import {
  RuleMap,
  AnyRule,
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
  Call2Rule,
  ObjectRule,
  References,
  IntRule,
  BoolRule,
} from "./grammar-builder.ts";
import { TokensStore } from "./tokens.ts";

type IRuleVisitor = {
  [key in keyof RuleMap]: (node: RuleMap[key]) => void;
};

export abstract class RuleVisitor<
  Data extends ReadonlyData,
  ReadonlyData = Data,
> implements IRuleVisitor
{
  protected readonly data: Data;

  constructor(data: Data) {
    this.data = data;
  }

  seq(node: SeqRule) {
    for (const n of node.rules) {
      this.visit(n);
    }
  }

  choice(node: ChoiceRule) {
    for (const n of node.rules) {
      this.visit(n);
    }
  }

  repeat(node: RepeatRule) {
    this.visit(node.rule);
  }

  repeat1(node: Repeat1Rule) {
    this.visit(node.rule);
  }

  optional(node: OptionalRule) {
    this.visit(node.rule);
  }

  empty(node: EmptyRule) {}

  eof(node: EofRule) {}

  string(node: StringRule) {}

  regexp(node: RegExpRule) {}

  object(node: ObjectRule) {
    for (const [_, expr] of node.fields) {
      this.visit(expr);
    }
  }

  int(node: IntRule) {}

  bool(node: BoolRule) {}

  id(node: IdRule) {}

  call(node: CallRule) {
    for (const arg of node.args) {
      this.visit(arg);
    }
  }

  call2(node: Call2Rule) {
    for (const arg of node.args) {
      this.visit(arg);
    }
  }

  field(node: FieldRule) {
    this.visit(node.rule);
  }

  predicate(node: PredicateRule) {}

  rule(node: AugmentedRuleDeclaration) {
    this.visit(node.rule);
    if (node.return) this.visit(node.return);
  }

  token(node: AugmentedTokenDeclaration) {
    this.visit(node.rule);
    if (node.return) this.visit(node.return);
  }

  visit(node: AnyRule) {
    this[node.type](node as any);
  }

  visitRuleDecls(decls: readonly AugmentedRuleDeclaration[]) {
    for (const decl of decls) {
      this.rule(decl);
    }
    return this;
  }

  visitTokenDecls(decls: readonly AugmentedTokenDeclaration[]) {
    for (const decl of decls) {
      this.token(decl);
    }
    return this;
  }

  visitDecl(decl: AugmentedDeclaration) {
    if (decl.type === "rule") {
      this.rule(decl);
    } else {
      this.token(decl);
    }
    return this;
  }

  visitAllDecls(decls: readonly AugmentedDeclaration[]) {
    for (const decl of decls) {
      this.visitDecl(decl);
    }
    return this;
  }

  get(): ReadonlyData {
    return this.data;
  }
}

export class FieldsCollector extends RuleVisitor<
  Map<string, FieldRule[]>,
  ReadonlyMap<string, FieldRule[]>
> {
  constructor() {
    super(new Map());
  }

  override field(node: FieldRule) {
    const array = this.data.get(node.name) ?? [];
    array.push(node);
    this.data.set(node.name, array);
    super.field(node);
  }

  run(node: AnyRule) {
    this.visit(node);
    return this.get();
  }
}

export class TokensCollector extends RuleVisitor<TokensStore> {
  constructor() {
    super(new TokensStore());
  }

  override string(node: StringRule) {
    this.data.get(node);
  }

  override regexp(node: RegExpRule) {
    this.data.get(node);
  }

  override eof(node: EofRule) {
    this.data.get(node);
  }

  override token(node: AugmentedTokenDeclaration) {
    this.data.get(node);
  }
}

export class ReferencesCollector extends RuleVisitor<
  References[],
  readonly References[]
> {
  constructor() {
    super([]);
  }

  override call(node: CallRule) {
    this.data.push(node);
    super.call(node);
  }

  override id(node: IdRule) {
    this.data.push(node);
    super.id(node);
  }
}

export class ExternalCallsCollector extends RuleVisitor<
  Map<string, Call2Rule[]>,
  ReadonlyMap<string, readonly Call2Rule[]>
> {
  constructor() {
    super(new Map());
  }

  override call2(node: Call2Rule) {
    const array = this.data.get(node.id) ?? [];
    array.push(node);
    this.data.set(node.id, array);
    super.call2(node);
  }
}
