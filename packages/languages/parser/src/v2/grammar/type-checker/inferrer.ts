import { GrammarError } from "../grammar";
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
} from "../grammar-builder";
import { GrammarFormatter } from "../grammar-formatter";
import { TypesRegistry, AnyType, FreeType } from "./types";
import { Normalizer } from "./normalizer";
import { TypeChecker } from "./checker";

class Store {
  private readonly map: Map<string, FreeType> = new Map();
  private readonly registry: TypesRegistry;
  constructor(registry: TypesRegistry) {
    this.registry = registry;
  }

  set(name: string, type: AnyType) {
    this.registry.subtype(type, this.get(name), null);
  }

  get(name: string) {
    const curr = this.map.get(name);
    if (curr) return curr;
    const type = this.registry.free();
    this.map.set(name, type);
    return type;
  }

  propagateTo(other: Store) {
    for (const [name, type] of this.map) {
      other.set(name, type);
    }
  }

  propagateToExcept(other: Store, except: string) {
    for (const [name, type] of this.map) {
      if (name !== except) {
        other.set(name, type);
      }
    }
  }

  toString(normalized: ReadonlyMap<AnyType, AnyType> = new Map()) {
    return `Store {${Array.from(this.map).map(
      ([k, v]) => `${k}: ${normalized.get(v) ?? v}`
    )}}`;
  }

  takeTypes(set: Set<AnyType>) {
    for (const [_, type] of this.map) {
      set.add(type);
    }
  }
}

export type RuleDeclarationInterface = Readonly<{
  argTypes: ReadonlyMap<string, AnyType>;
  returnType: AnyType;
}>;

export type TokenDeclarationInterface = Readonly<{
  returnType: AnyType;
}>;

type RuleAnalyzer<T> = {
  [key in keyof RuleMap]: (pre: T, node: RuleMap[key], post: T) => void;
};

export class TypesInferrer implements RuleAnalyzer<Store> {
  private readonly registry = new TypesRegistry();
  private readonly normalizer = new Normalizer(this.registry);
  private readonly formatter = new GrammarFormatter();
  private readonly typeChecker = new TypeChecker(
    this.registry,
    this.normalizer,
    this.formatter
  );

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

  private valueType(value: Assignables) {
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
    this.registry.subtype(this.registry.null(node), this.valueType(node), node);
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
    pre.propagateTo(post);
    this.visitSeq(
      pre,
      node.fields.map(([_, v]) => v),
      post
    );
    this.registry.subtype(
      this.registry.readonlyObject(
        node.fields.map(([k, v]) => [k, this.valueType(v)]),
        node
      ),
      this.valueType(node),
      node
    );
  }

  id(pre: Store, node: IdRule, post: Store) {
    pre.propagateTo(post);
    this.registry.subtype(pre.get(node.id), this.valueType(node), node);
  }

  int(pre: Store, node: IntRule, post: Store) {
    pre.propagateTo(post);
    this.registry.subtype(this.registry.int(node), this.valueType(node), node);
  }

  select(pre: Store, node: SelectRule, post: Store) {
    const [preExpr, postExpr] = this.store(node.parent);
    pre.propagateTo(preExpr);
    this.visit(node.parent);
    //
    postExpr.propagateTo(post);
    this.registry.subtype(
      this.valueType(node.parent),
      this.registry.readonlyObject([[node.field, this.valueType(node)]], node),
      node
    );
  }

  call2(pre: Store, node: Call2Rule, post: Store) {
    // TODO
    pre.propagateTo(post);
  }

  call(pre: Store, node: CallRule, post: Store) {
    // TODO
    pre.propagateTo(post);
  }

  field(pre: Store, node: FieldRule, post: Store) {
    const [preExpr, postExpr] = this.store(node.rule);
    pre.propagateTo(preExpr);
    this.visit(node.rule);
    //
    if (node.multiple) {
      this.registry.subtype(
        postExpr.get(node.name),
        this.registry.array(this.valueType(node.rule), node),
        node
      );
      postExpr.propagateTo(post);
    } else {
      postExpr.propagateToExcept(post, node.name);
      post.set(node.name, this.valueType(node.rule));
    }
  }

  predicate(pre: Store, node: PredicateRule, post: Store) {
    // TODO
  }

  run(rule: RuleDeclaration): RuleDeclarationInterface {
    const argTypes = new Map<string, AnyType>();
    const [preRule, postRule] = this.store(rule.rule);

    for (const { arg } of new Set(rule.args)) {
      preRule.set(arg, this.registry.free());
    }

    for (const [name, [{ multiple }]] of rule.fields) {
      if (multiple) {
        preRule.set(name, this.registry.array(this.registry.free(), rule.rule));
      } else {
        preRule.set(name, this.registry.null(rule.rule));
      }
    }

    this.visit(rule.rule);

    const [preReturn, _] = this.store(rule.return);

    postRule.propagateTo(preReturn);

    this.visit(rule.return);

    return {
      argTypes,
      returnType: this.valueType(rule.return),
    };
  }

  visit(node: AnyRule) {
    const [pre, post] = this.store(node);
    this[node.type](pre, node as any, post);
  }

  check(errors: GrammarError[]) {
    /*console.log("---- STORES ----");
    for (const [rule, [pre, post]] of this.stores) {
      console.log(new GrammarFormatter().visit(rule));
      console.log("PRE:", pre.toString(normalized));
      console.log("POST:", post.toString(normalized));
    }*/

    /*console.log("---- VALUES ----");
    for (const [value, type] of this.valueTypes) {
      console.log(
        new GrammarFormatter().visit(value),
        // type.toString(),
        normalized.get(type)?.toString()
      );
    }*/

    /*console.log("---- NORMALIZED ----");

    for (const type of this.registry) {
      //const supersArr = Array.from(this.registry.getSupers(type));
      //console.log(type.simpleFormat());
      console.log(this.normalizer.normalize(type).toTypescript());
    }

    console.log("---- ERRORS ----");*/

    this.typeChecker.check(errors);
  }

  normalize(type: AnyType) {
    return this.normalizer.normalize(type);
  }

  usedRecursiveRefs() {
    return this.normalizer.getUsedRecursiveRefs();
  }
}
