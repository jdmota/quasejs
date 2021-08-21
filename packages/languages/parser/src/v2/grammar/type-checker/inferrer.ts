import { Grammar, GrammarError } from "../grammar";
import {
  RuleMap,
  Assignables,
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
  AnyRule,
  Call2Rule,
  ObjectRule,
  IntRule,
  TokenDeclaration,
  Declaration,
  ExprRule,
} from "../grammar-builder";
import { GrammarFormatter } from "../grammar-formatter";
import { TypesRegistry, AnyType, FreeType, TypePolarity } from "./types";
import { Normalizer } from "./normalizer";
import { TypeChecker } from "./checker";
import { Store } from "./store";
import { nonNull } from "../../utils";

export type RuleDeclInterface = Readonly<{
  argTypes: ReadonlyMap<string, AnyType>;
  returnType: AnyType;
}>;

export type TokenDeclInterface = Readonly<{
  argTypes: ReadonlyMap<string, AnyType>; // Empty map
  returnType: AnyType;
}>;

export type ExternalCallInterface = Readonly<{
  argTypes: AnyType[];
  returnType: AnyType;
}>;

type RuleAnalyzer<T> = {
  [key in keyof RuleMap]: (pre: T, node: RuleMap[key], post: T) => void;
};

export class TypesInferrer implements RuleAnalyzer<Store> {
  public readonly registry = new TypesRegistry();
  public readonly normalizer = new Normalizer(this.registry);
  private readonly formatter = new GrammarFormatter();
  private readonly typeChecker = new TypeChecker(
    this.registry,
    this.normalizer,
    this.formatter
  );

  private readonly ruleDeclTypes = new Map<
    RuleDeclaration,
    RuleDeclInterface
  >();
  private readonly tokenDeclTypes = new Map<
    TokenDeclaration,
    TokenDeclInterface
  >();
  private readonly externalCallTypes = new Map<string, ExternalCallInterface>();

  constructor(private readonly grammar: Grammar) {}

  public getRuleInterfaces(): ReadonlyMap<RuleDeclaration, RuleDeclInterface> {
    return this.ruleDeclTypes;
  }

  public getTokenInterfaces(): ReadonlyMap<
    TokenDeclaration,
    TokenDeclInterface
  > {
    return this.tokenDeclTypes;
  }

  public getExternalCallInterfaces(): ReadonlyMap<
    string,
    ExternalCallInterface
  > {
    return this.externalCallTypes;
  }

  public declInterface(decl: Declaration) {
    if (decl.type === "rule") {
      return this.ruleDeclInterface(decl);
    }
    return this.tokenDeclInterface(decl);
  }

  public ruleDeclInterface(rule: RuleDeclaration) {
    let inter = this.ruleDeclTypes.get(rule);
    if (!inter) {
      inter = {
        argTypes: new Map(
          rule.args.map(arg => [
            arg.arg,
            this.registry.free(TypePolarity.GENERAL),
          ])
        ),
        returnType: this.registry.free(TypePolarity.SPECIFIC),
      };
      this.ruleDeclTypes.set(rule, inter);
    }
    return inter;
  }

  public tokenDeclInterface(rule: TokenDeclaration) {
    let inter = this.tokenDeclTypes.get(rule);
    if (!inter) {
      inter = {
        argTypes: new Map(),
        returnType: this.registry.free(TypePolarity.SPECIFIC),
      };
      this.tokenDeclTypes.set(rule, inter);
    }
    return inter;
  }

  public externalCallInterface(call: Call2Rule) {
    let inter = this.externalCallTypes.get(call.id);
    if (!inter) {
      inter = {
        argTypes: call.args.map(_ => this.registry.free(TypePolarity.GENERAL)),
        returnType: this.registry.free(TypePolarity.SPECIFIC),
      };
      this.externalCallTypes.set(call.id, inter);
    }
    return inter;
  }

  private readonly stores = new Map<AnyRule, readonly [Store, Store]>();
  private readonly valueTypes = new Map<Assignables, AnyType>();

  private store(rule: AnyRule) {
    let pair = this.stores.get(rule);
    if (pair == null) {
      pair = [new Store(this.registry), new Store(this.registry)];
      this.stores.set(rule, pair);
    }
    return pair;
  }

  private exprType(value: Assignables) {
    let type = this.valueTypes.get(value);
    if (type == null) {
      type = this.registry.free();
      this.valueTypes.set(value, type);
    }
    return type;
  }

  private visitSeq(pre: Store, rules: readonly AnyRule[], post: Store) {
    let lastPre = pre;
    for (let i = 0; i < rules.length; i++) {
      const [preRule, postRule] = this.store(rules[i]);
      lastPre.propagateTo(preRule);
      this.visit(rules[i]);
      lastPre = postRule;
    }
    lastPre.propagateTo(post);
  }

  seq(pre: Store, node: SeqRule, post: Store) {
    this.visitSeq(pre, node.rules, post);
  }

  choice(pre: Store, node: ChoiceRule, post: Store) {
    for (const n of node.rules) {
      const [preRule, postRule] = this.store(n);
      pre.propagateTo(preRule);
      this.visit(n);
      postRule.propagateTo(post);
    }
  }

  repeat(pre: Store, node: RepeatRule, post: Store) {
    // May run 0 times
    pre.propagateTo(post);
    // Inner rule...
    const [preRule, postRule] = this.store(node.rule);
    pre.propagateTo(preRule);
    this.visit(node.rule);
    postRule.propagateTo(post);
    // May run 1 or more times
    post.propagateTo(pre);
  }

  repeat1(pre: Store, node: Repeat1Rule, post: Store) {
    // Inner rule...
    const [preRule, postRule] = this.store(node.rule);
    pre.propagateTo(preRule);
    this.visit(node.rule);
    postRule.propagateTo(post);
    // Runs 1 or more times
    post.propagateTo(pre);
  }

  optional(pre: Store, node: OptionalRule, post: Store) {
    // May run 0 times
    pre.propagateTo(post);
    // Inner rule...
    // May run 1 time
    const [preRule, postRule] = this.store(node.rule);
    pre.propagateTo(preRule);
    this.visit(node.rule);
    postRule.propagateTo(post);
  }

  empty(pre: Store, node: EmptyRule, post: Store) {
    pre.propagateTo(post);
  }

  eof(pre: Store, node: EofRule, post: Store) {
    pre.propagateTo(post);
    this.registry.subtype(this.registry.null(node), this.exprType(node), node);
  }

  string(pre: Store, node: StringRule, post: Store) {
    pre.propagateTo(post);
    // TODO
  }

  regexp(pre: Store, node: RegExpRule, post: Store) {
    pre.propagateTo(post);
    // TODO
  }

  object(pre: Store, node: ObjectRule, post: Store) {
    this.visitSeq(
      pre,
      node.fields.map(([_, v]) => v),
      post
    );

    const objType = this.registry.readonlyObject(
      node.fields.map(([k, _]) => k),
      node
    );
    node.fields.forEach(([field, expr]) =>
      this.registry.subtype(
        this.exprType(expr),
        nonNull(objType.fields.get(field)),
        expr
      )
    );
    this.registry.subtype(objType, this.exprType(node), node);
  }

  id(pre: Store, node: IdRule, post: Store) {
    pre.propagateTo(post);
    this.registry.subtype(pre.get(node.id), this.exprType(node), node);
  }

  int(pre: Store, node: IntRule, post: Store) {
    pre.propagateTo(post);
    this.registry.subtype(this.registry.int(node), this.exprType(node), node);
  }

  select(pre: Store, node: SelectRule, post: Store) {
    const [preExpr, postExpr] = this.store(node.parent);
    pre.propagateTo(preExpr);
    this.visit(node.parent);
    //
    postExpr.propagateTo(post);
    const objType = this.registry.readonlyObject([node.field], node);
    this.registry.subtype(
      nonNull(objType.fields.get(node.field)),
      this.exprType(node),
      node
    );
    this.registry.subtype(this.exprType(node.parent), objType, node);
  }

  call2(pre: Store, node: Call2Rule, post: Store) {
    const { argTypes, returnType } = this.externalCallInterface(node);
    this.visitSeq(pre, node.args, post);
    this.handleCall(argTypes.values(), node.args.values(), returnType, node);
  }

  call(pre: Store, node: CallRule, post: Store) {
    const { argTypes, returnType } = this.declInterface(
      this.grammar.getRule(node.id)
    );
    this.visitSeq(pre, node.args, post);
    this.handleCall(argTypes.values(), node.args.values(), returnType, node);
  }

  private handleCall(
    argTypes: IterableIterator<AnyType>,
    exprs: IterableIterator<ExprRule>,
    returnType: AnyType,
    node: CallRule | Call2Rule
  ) {
    while (true) {
      const expected = argTypes.next();
      const expr = exprs.next();
      if (expected.done || expr.done) break;
      this.registry.subtype(
        this.exprType(expr.value),
        expected.value,
        expr.value
      );
    }
    this.registry.subtype(returnType, this.exprType(node), node);
  }

  field(pre: Store, node: FieldRule, post: Store) {
    const [preExpr, postExpr] = this.store(node.rule);
    pre.propagateTo(preExpr);
    this.visit(node.rule);
    //
    if (node.multiple) {
      const arrayType = this.registry.array(node);
      this.registry.subtype(
        this.exprType(node.rule),
        arrayType.component,
        node
      );
      this.registry.subtype(postExpr.get(node.name), arrayType, node);
      postExpr.propagateTo(post);
    } else {
      postExpr.propagateToExcept(post, node.name);
      post.set(node.name, this.exprType(node.rule));
    }
  }

  predicate(pre: Store, node: PredicateRule, post: Store) {
    const [preExpr, postExpr] = this.store(node.code);
    pre.propagateTo(preExpr);
    this.visit(node.code);
    postExpr.propagateTo(post);
    //
    this.registry.subtype(
      this.registry.boolean(node.code),
      this.exprType(node.code),
      node.code
    );
  }

  run(rule: RuleDeclaration) {
    const { argTypes, returnType } = this.ruleDeclInterface(rule);
    const [preRule, postRule] = this.store(rule.rule);

    for (const [name, type] of argTypes) {
      preRule.set(name, type);
    }

    for (const [name, [{ multiple }]] of rule.fields) {
      if (multiple) {
        preRule.set(name, this.registry.array(rule.rule));
      } else {
        preRule.set(name, this.registry.null(rule.rule));
      }
    }

    this.visit(rule.rule);

    const [preReturn, _] = this.store(rule.return);
    postRule.propagateTo(preReturn);
    this.visit(rule.return);
    this.registry.subtype(this.exprType(rule.return), returnType, rule.return);
  }

  visit(node: AnyRule) {
    const [pre, post] = this.store(node);
    this[node.type](pre, node as any, post);
  }

  check(errors: GrammarError[]) {
    this.typeChecker.check(errors);
  }
}
