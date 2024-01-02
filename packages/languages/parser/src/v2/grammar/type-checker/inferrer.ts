import { Grammar, GrammarError, err } from "../grammar";
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
  SelectRule,
  SeqRule,
  StringRule,
  AnyRule,
  Call2Rule,
  ObjectRule,
  IntRule,
  Declaration,
} from "../grammar-builder";
import { never, nonNull } from "../../utils";
import {
  GFuncType,
  GType,
  RecursiveTypeCreator,
  typeBuilder,
} from "./types-builder";
import { runtimeFuncs, runtimeTypes } from "./default-types";
import { isSub } from "./subtyping";
import { typeFormatter } from "./types-formatter";

type RuleAnalyzer<T> = {
  [key in keyof RuleMap]: (pair: T, node: RuleMap[key]) => void;
};

function merge(current: GType | undefined, type: GType) {
  try {
    // TODO
    if (current && isSub(type, current)) {
      return current;
    }
  } catch (err) {}
  return current ? typeBuilder.union([current, type]) : type;
}

class Store {
  private readonly t: TypesInferrer;
  private readonly map: Map<string, GType> = new Map();
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

  get(name: AnyRule | string) {
    return this.map.get(this.strName(name));
  }

  merge(name: AnyRule | string, type: GType) {
    name = this.strName(name);
    const current = this.map.get(name);
    const next = merge(current, type);
    if (current === next) {
      return false;
    }
    this.map.set(name, next);
    this.changed = true;
    return true; // It changed
  }

  set(name: AnyRule | string, type: GType) {
    this.map.set(this.strName(name), type);
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
    for (const [name, type] of this.map) {
      changed = other.merge(name, type) || changed;
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
              node.fields.map(([k, v]) => [k, nonNull(pair.post.get(v))])
            )
          )
    );
  }

  id({ pre, post }: StorePair, node: IdRule) {
    pre.propagateTo(post);
  }

  private getField(t: GType, field: string): { type: GType; errors: string[] } {
    switch (t.type) {
      case "readObject":
        const v = t.fields.get(field);
        return v
          ? { type: v, errors: [] }
          : {
              type: typeBuilder.never(),
              errors: [
                `Field ${field} does not exist in ${
                  typeFormatter(t).typescript
                }`,
              ],
            };
      case "func":
      case "readArray":
      case "array":
      case "null":
      case "string":
      case "int":
      case "bool":
      case "top":
        return {
          type: typeBuilder.never(),
          errors: [`${typeFormatter(t).typescript} is not an object type`],
        };
      case "bot":
        return { type: t, errors: [] };
      case "recursive":
        return this.getField(t.content, field);
      case "recursive-var":
        return this.getField(t.definition().content, field);
      case "union": {
        const results = t.types.map(t => this.getField(t, field));
        return {
          type: typeBuilder.union(results.map(r => r.type)),
          errors: results.reduce<string[]>(
            (acc, { errors }) => acc.concat(errors),
            []
          ),
        };
      }
      case "inter": {
        const results = t.types
          .map(t => this.getField(t, field))
          .filter(r => r.errors.length === 0);
        if (results.length === 0) {
          return {
            type: typeBuilder.never(),
            errors: [
              `Field ${field} does not exist in ${typeFormatter(t).typescript}`,
            ],
          };
        }
        return {
          type: typeBuilder.inter(results.map(r => r.type)),
          errors: [],
        };
      }
      default:
        never(t);
    }
  }

  private getArrayComponent(t: GType): { type: GType; errors: string[] } {
    switch (t.type) {
      case "readArray":
      case "array":
        return {
          type: t.component,
          errors: t.type === "readArray" ? ["Not write in readonly array"] : [],
        };
      case "readObject":
      case "func":
      case "null":
      case "string":
      case "int":
      case "bool":
      case "top":
        return {
          type: typeBuilder.never(),
          errors: [`${typeFormatter(t).typescript} is not an array type`],
        };
      case "bot":
        return { type: t, errors: [] };
      case "recursive":
        return this.getArrayComponent(t.content);
      case "recursive-var":
        return this.getArrayComponent(t.definition().content);
      case "union": {
        const results = t.types.map(t => this.getArrayComponent(t));
        return {
          type: typeBuilder.union(results.map(r => r.type)),
          errors: results.reduce<string[]>(
            (acc, { errors }) => acc.concat(errors),
            []
          ),
        };
      }
      case "inter": {
        const results = t.types
          .map(t => this.getArrayComponent(t))
          .filter(r => r.errors.length === 0);
        if (results.length === 0) {
          return {
            type: typeBuilder.never(),
            errors: [`${typeFormatter(t).typescript} is not an array type`],
          };
        }
        return {
          type: typeBuilder.inter(results.map(r => r.type)),
          errors: [],
        };
      }
      default:
        never(t);
    }
  }

  select({ pre, post }: StorePair, node: SelectRule) {
    const { pre: preExpr, post: postExpr } = this.store(node.parent);
    pre.propagateTo(preExpr);
    this.visit(node.parent);
    postExpr.propagateTo(post);
    //
    const objType = nonNull(postExpr.get(node.parent));
    const { type: fieldType, errors } = this.getField(objType, node.field);
    for (const error of errors) this.errors.push(err(error, node.loc));
    post.merge(node, fieldType);
  }

  call2(pair: StorePair, node: Call2Rule) {
    this.visitSeq(pair, node.args);
    //
    let funcType: GFuncType;
    if (node.id.startsWith("$")) {
      funcType = nonNull(
        runtimeFuncs[node.id.slice(1) as keyof typeof runtimeFuncs]
      );
    } else {
      funcType = this.grammar.externalFunctions[node.id];

      const funcArgs = this.externalArgs(node.id);
      node.args.forEach((a, i) => {
        funcArgs[i] = merge(funcArgs[i], nonNull(pair.post.get(a)));

        /*const expected = funcType.args[i];
        if (!isSub(actual, expected)) {
          this.errors.push(
            err(
              `${typeFormatter(actual).typescript} is not a subtype of ${
                typeFormatter(expected).typescript
              }`,
              node.loc
            )
          );
        }*/
      });
    }
    pair.post.merge(node, funcType.ret);
  }

  call(pair: StorePair, node: CallRule) {
    const calledRule = this.grammar.getRule(node.id);
    this.visitSeq(pair, node.args);
    //
    const argTypes = node.args.map(a => nonNull(pair.post.get(a)));
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

      const { type: component, errors } = this.getArrayComponent(
        nonNull(post.get(node.name))
      );
      for (const error of errors) this.errors.push(err(error, node.loc));
      const newComponent = merge(component, nonNull(postExpr.get(node.rule)));
      if (component !== newComponent) {
        post.set(node.name, typeBuilder.array(newComponent));
      }
    } else {
      postExpr.propagateTo(post);
      post.set(node.name, nonNull(postExpr.get(node.rule)));
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

  declaration(rule: Declaration, argTypes: GType[]) {
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
          preRule.merge(name, typeBuilder.array(typeBuilder.never()));
        } else {
          preRule.merge(name, typeBuilder.null());
        }
      }

      this.visit(rule.rule);
      postRule.propagateTo(preReturn);
      this.visit(rule.return);
    }

    const resultType = recCreator.create(nonNull(postReturn.get(rule.return)));
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
    const given = this.grammar.externalFunctions[call];
    return typeBuilder.func(funcArgs, given.ret);
  }

  print() {
    const knownNames = new Map(
      Object.entries(runtimeTypes).map(([a, b]) => [b, a])
    );

    for (const rule of this.grammar.rules.values()) {
      const { pre: preReturn, post: postReturn } = this.store(rule.return);
      const t = postReturn.get(rule.return);
      console.log(
        "rule",
        rule.name,
        t ? typeFormatter(t, knownNames) : undefined
      );
    }
  }
}
