import {
  AugmentedDeclaration,
  Grammar,
  GrammarError,
  err,
} from "../grammar.ts";
import {
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
} from "../grammar-builder.ts";
import { assertion, nonNull } from "../../utils/index.ts";
import { GType, RecursiveTypeCreator, typeBuilder } from "./types-builder.ts";
import { runtimeFuncs, runtimeTypes } from "./default-types.ts";
import { isSub } from "./subtyping.ts";
import { typeFormatter } from "./types-formatter.ts";

type RuleAnalyzer<T> = {
  [key in keyof RuleMap]: (pair: T, node: RuleMap[key]) => void;
};

function merge(current: GType | undefined, type: GType) {
  if (current && isSub(type, current)) {
    return current;
  }
  return current ? typeBuilder.union([current, type]) : type;
}

class Store {
  private readonly t: TypesInferrer;
  private readonly map: Map<string, { readonly array: boolean; type: GType }> =
    new Map();
  private changed = true; // Because it was just initialized

  constructor(t: TypesInferrer) {
    this.t = t;
  }

  private strName(name: AnyRule | string) {
    return typeof name === "string"
      ? name
      : name.type === "id"
        ? name.id
        : this.t.genId(name);
  }

  read(name: AnyRule | string) {
    const { type, array } = nonNull(this.map.get(this.strName(name)));
    return array ? typeBuilder.readArray(type) : type;
  }

  set(name: AnyRule | string, type: GType, array: boolean) {
    this.map.set(this.strName(name), { array, type });
    this.changed = true;
    return true; // It changed
  }

  merge(name: AnyRule | string, type: GType, array: boolean = false) {
    name = this.strName(name);
    const current = this.map.get(name);
    if (current) {
      assertion(current.array === array);
      const next = merge(current?.type, type);
      if (current.type === next) {
        return false;
      }
      this.map.set(name, { array, type: next });
    } else {
      this.map.set(name, { array, type });
    }
    this.changed = true;
    return true; // It changed
  }

  markUnchanged() {
    this.changed = false;
  }

  didChange() {
    return this.changed;
  }

  propagateTo(other: Store) {
    let changed = false;
    for (const [name, { array, type }] of this.map) {
      changed = other.merge(name, type, array) || changed;
    }
    return changed;
  }
}

class StorePair {
  readonly pre: Store;
  readonly post: Store;

  constructor(t: TypesInferrer) {
    this.pre = new Store(t);
    this.post = new Store(t);
  }
}

export class TypesInferrer implements RuleAnalyzer<StorePair> {
  readonly errors: GrammarError[] = [];

  constructor(private readonly grammar: Grammar) {}

  private readonly stores = new Map<AnyRule, StorePair>();
  private readonly allExternalArgs = new Map<string, GType[]>();
  private readonly nodeIds = new Map<AnyRule, string>();

  genId(node: AnyRule) {
    let id = this.nodeIds.get(node);
    if (id == null) {
      id = "#node" + this.nodeIds.size;
      this.nodeIds.set(node, id);
    }
    return id;
  }

  private store(node: AnyRule) {
    let pair = this.stores.get(node);
    if (pair == null) {
      pair = new StorePair(this);
      this.stores.set(node, pair);
    }
    return pair;
  }

  private externalArgs(call: string) {
    let stores = this.allExternalArgs.get(call);
    if (stores == null) {
      stores = [];
      this.allExternalArgs.set(call, stores);
    }
    return stores;
  }

  private visitSeq(pair: StorePair, rules: readonly AnyRule[]) {
    let lastPre = pair.pre;
    for (let i = 0; i < rules.length; i++) {
      const { pre: preRule, post: postRule } = this.store(rules[i]);
      lastPre.propagateTo(preRule);
      if (!preRule.didChange()) return;
      this.visit(rules[i]);
      lastPre = postRule;
    }
    lastPre.propagateTo(pair.post);
  }

  seq(pair: StorePair, node: SeqRule) {
    this.visitSeq(pair, node.rules);
  }

  choice({ pre, post }: StorePair, node: ChoiceRule) {
    for (const n of node.rules) {
      const { pre: preRule, post: postRule } = this.store(n);
      pre.propagateTo(preRule);
      this.visit(n);
      postRule.propagateTo(post);
    }
  }

  repeat({ pre, post }: StorePair, node: RepeatRule) {
    do {
      pre.markUnchanged();
      // May run 0 times
      pre.propagateTo(post);
      // Inner rule...
      const { pre: preRule, post: postRule } = this.store(node.rule);
      pre.propagateTo(preRule);
      this.visit(node.rule);
      postRule.propagateTo(post);
      // May run 1 or more times
      post.propagateTo(pre);
    } while (pre.didChange());
  }

  repeat1({ pre, post }: StorePair, node: Repeat1Rule) {
    do {
      pre.markUnchanged();
      // Inner rule...
      const { pre: preRule, post: postRule } = this.store(node.rule);
      pre.propagateTo(preRule);
      this.visit(node.rule);
      postRule.propagateTo(post);
      // Runs 1 or more times
      post.propagateTo(pre);
    } while (pre.didChange());
  }

  optional({ pre, post }: StorePair, node: OptionalRule) {
    // May run 0 times
    pre.propagateTo(post);
    // Inner rule...
    // May run 1 time
    const { pre: preRule, post: postRule } = this.store(node.rule);
    pre.propagateTo(preRule);
    this.visit(node.rule);
    postRule.propagateTo(post);
  }

  empty({ pre, post }: StorePair, node: EmptyRule) {
    pre.propagateTo(post);
  }

  eof({ pre, post }: StorePair, node: EofRule) {
    pre.propagateTo(post);
    post.merge(node, typeBuilder.null());
  }

  int({ pre, post }: StorePair, node: IntRule) {
    pre.propagateTo(post);
    post.merge(node, typeBuilder.int());
  }

  bool({ pre, post }: StorePair, node: BoolRule) {
    pre.propagateTo(post);
    post.merge(node, typeBuilder.bool());
  }

  string({ pre, post }: StorePair, node: StringRule) {
    pre.propagateTo(post);
    post.merge(node, typeBuilder.string());
  }

  regexp({ pre, post }: StorePair, node: RegExpRule) {
    pre.propagateTo(post);
    post.merge(node, typeBuilder.string());
  }

  object(pair: StorePair, node: ObjectRule) {
    this.visitSeq(
      pair,
      node.fields.map(([_, v]) => v)
    );

    pair.post.merge(
      node,
      node.fields.length === 0
        ? runtimeTypes.$Empty
        : typeBuilder.readObject(
            Object.fromEntries(
              node.fields.map(([k, v]) => [k, pair.post.read(v)])
            )
          )
    );
  }

  id({ pre, post }: StorePair, node: IdRule) {
    pre.propagateTo(post);
  }

  call2(pair: StorePair, node: Call2Rule) {
    this.visitSeq(pair, node.args);
    //
    let retType: GType;
    if (node.id.startsWith("$")) {
      retType = nonNull(runtimeFuncs[node.id as keyof typeof runtimeFuncs]).ret;
    } else {
      retType = this.grammar.externalFuncReturns[node.id];

      const funcArgs = this.externalArgs(node.id);
      node.args.forEach((a, i) => {
        funcArgs[i] = merge(funcArgs[i], pair.post.read(a));
      });
    }
    pair.post.merge(node, retType);
  }

  call(pair: StorePair, node: CallRule) {
    const calledRule = this.grammar.getRule(node.id);
    this.visitSeq(pair, node.args);
    //
    const argTypes = node.args.map(a => pair.post.read(a));
    const resultType = this.declaration(calledRule, argTypes);
    pair.post.merge(node, resultType);
  }

  field({ pre, post }: StorePair, node: FieldRule) {
    const { pre: preExpr, post: postExpr } = this.store(node.rule);
    pre.propagateTo(preExpr);
    this.visit(node.rule);
    //
    if (node.multiple) {
      postExpr.propagateTo(post);
      post.merge(node.name, postExpr.read(node.rule), true);
    } else {
      postExpr.propagateTo(post);
      post.set(node.name, postExpr.read(node.rule), false);
    }
  }

  predicate({ pre, post }: StorePair, node: PredicateRule) {
    const { pre: preExpr, post: postExpr } = this.store(node.code);
    pre.propagateTo(preExpr);
    this.visit(node.code);
    postExpr.propagateTo(post);
    //
    post.merge(node, typeBuilder.bool());
  }

  private ruleStack = new Map<string, RecursiveTypeCreator>();

  declaration(rule: AugmentedDeclaration, argTypes: GType[]) {
    let recCreator = this.ruleStack.get(rule.name);
    if (recCreator) {
      return recCreator.getVar();
    }

    recCreator = new RecursiveTypeCreator();
    this.ruleStack.set(rule.name, recCreator);

    const { pre: preRule, post: postRule } = this.store(rule.rule);
    const { pre: preReturn, post: postReturn } = this.store(rule.return);

    argTypes.forEach((type, i) => {
      preRule.merge(rule.args[i].arg, type);
    });

    if (preRule.didChange()) {
      preRule.markUnchanged();

      for (const [name, [{ multiple }]] of rule.fields) {
        if (multiple) {
          preRule.set(name, typeBuilder.never(), true);
        } else {
          preRule.set(name, typeBuilder.null(), false);
        }
      }

      this.visit(rule.rule);
      postRule.propagateTo(preReturn);
      this.visit(rule.return);
    }

    const resultType = recCreator.create(postReturn.read(rule.return));
    this.ruleStack.delete(rule.name);
    return resultType;
  }

  visit(node: AnyRule) {
    const pair = this.store(node);
    if (pair.pre.didChange()) {
      pair.pre.markUnchanged();
      this[node.type](pair, node as any);
    }
    return pair;
  }

  getExternalCallType(call: string) {
    const funcArgs = this.externalArgs(call);
    const ret = this.grammar.externalFuncReturns[call];
    return typeBuilder.func(funcArgs, ret);
  }

  print() {
    const knownNames = new Map(
      Object.entries(runtimeTypes).map(([a, b]) => [b, a])
    );

    for (const rule of this.grammar.rules.values()) {
      const { pre: preReturn, post: postReturn } = this.store(rule.return);
      const t = postReturn.read(rule.return);
      console.log("rule", rule.name, typeFormatter(t, knownNames));
    }
  }
}
