import {
  RuleMap,
  AnyRule,
  TokenRules,
  RuleDeclaration,
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
  SelectRule,
  SeqRule,
  StringRule,
  Call2Rule,
  ObjectRule,
  TokenDeclaration,
  Declaration,
  References,
  IntRule,
} from "./grammar-builder";
import { TokensStore } from "./tokens";

type IRuleVisitor = {
  [key in keyof RuleMap]: (node: RuleMap[key]) => void;
};

export abstract class RuleVisitor<
  Data extends ReadonlyData,
  ReadonlyData = Data
> implements IRuleVisitor {
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

  object(node: ObjectRule) {}

  int(node: IntRule) {}

  id(node: IdRule) {}

  select(node: SelectRule) {
    this.visit(node.parent);
  }

  call(node: CallRule) {}

  call2(node: Call2Rule) {}

  field(node: FieldRule) {
    this.visit(node.rule);
  }

  predicate(node: PredicateRule) {}

  rule(node: RuleDeclaration) {
    this.visit(node.rule);
    if (node.return != null) {
      this.visit(node.return);
    }
  }

  token(node: TokenDeclaration) {
    this.visit(node.rule);
    if (node.return != null) {
      this.visit(node.return);
    }
  }

  visit(node: AnyRule) {
    this[node.type](node as any);
  }

  visitRuleDecls(decls: readonly RuleDeclaration[]) {
    for (const decl of decls) {
      this.rule(decl);
    }
    return this;
  }

  visitTokenDecls(decls: readonly TokenDeclaration[]) {
    for (const decl of decls) {
      this.token(decl);
    }
    return this;
  }

  visitDecl(decl: Declaration) {
    if (decl.type === "rule") {
      this.rule(decl);
    } else {
      this.token(decl);
    }
    return this;
  }

  visitAllDecls(decls: readonly Declaration[]) {
    for (const decl of decls) {
      this.visitDecl(decl);
    }
    return this;
  }

  get(): ReadonlyData {
    return this.data;
  }
}

export class LocalsCollector extends RuleVisitor<string[], readonly string[]> {
  constructor() {
    super([]);
  }

  field(node: FieldRule) {
    this.data.push(node.name);
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

  string(node: StringRule) {
    this.data.get(node);
    super.string(node);
  }

  regexp(node: RegExpRule) {
    this.data.get(node);
    super.regexp(node);
  }

  eof(node: EofRule) {
    this.data.get(node);
    super.eof(node);
  }

  token(node: TokenDeclaration) {
    this.data.get(node);
    // No super call here
  }
}

export class ReferencesCollector extends RuleVisitor<
  References[],
  readonly References[]
> {
  constructor() {
    super([]);
  }

  call(node: CallRule) {
    this.data.push(node);
    super.call(node);
  }

  id(node: IdRule) {
    this.data.push(node);
    super.id(node);
  }
}
