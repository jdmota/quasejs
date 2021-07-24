import { Grammar } from "./grammar";
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
} from "./grammar-builder";
import { GrammarFormatter } from "./grammar-formatter";

/*

-------
t <: t

---------
t <: TOP

-----------
BOTTOM <: t

                      t_0 <: t'_0 ... t_n <: t'_n
--------------------------------------------------------------------------
ReadonlyObj{key1:t_0,...,keyn:t_n} <: ReadonlyObj{key1:t'_0,...,keyn:t'_n}

---------------------------------------------------------
ReadonlyObj{...keys} <: ReadonlyObj{...keys, freshKey: t}

                t <: t'
--------------------------------------
ReadonlyArray[t] <: ReadonlyArray[t']

-----------------------------
Array[t] <: ReadonlyArray[t]

t <: t'     t <: t''
--------------------
    t <: t' & t''

t' <: t     t'' <: t
--------------------
    t' | t'' <: t


a | b <: c & d if
- a <: c & d and b <: c & d
- a | b <: c and a | b <: d

*/

abstract class Type {
  readonly supertypes = new Set<Type>();
  subtypeOf(other: Type) {
    this.supertypes.add(other);
  }
  formatMeta(seen: Set<Type>): string {
    return "";
  }
  format(seen: Set<Type>): string {
    if (seen.has(this)) return "circular";
    seen.add(this);
    return `${this.constructor.name} {${[
      this.formatMeta(seen),
      this.supertypes.size > 0
        ? `supers: ${Array.from(this.supertypes)
            .map(t => t.format(seen))
            .join(", ")}`
        : "",
    ]
      .filter(Boolean)
      .join(", ")}}`;
  }
  toString() {
    return this.format(new Set());
  }
}

class ReadonlyObjectType extends Type {
  readonly fields: readonly (readonly [string, Type])[];
  constructor(fields: readonly (readonly [string, Type])[]) {
    super();
    this.fields = fields;
  }
  formatMeta(seen: Set<Type>) {
    return this.fields.map(([k, v]) => `${k}: ${v.format(seen)}`).join(", ");
  }
}

class ReadonlyArrayType extends Type {
  readonly component: Type;
  constructor(component: Type) {
    super();
    this.component = component;
  }
  formatMeta(seen: Set<Type>) {
    return `component: ${this.component.format(seen)}`;
  }
}

class ArrayType extends Type {
  readonly component: Type;
  constructor(component: Type) {
    super();
    this.component = component;
  }
  formatMeta(seen: Set<Type>) {
    return `component: ${this.component.format(seen)}`;
  }
}

class TopType extends Type {
  constructor() {
    super();
  }
}

class NullType extends Type {
  constructor() {
    super();
  }
}

class StringType extends Type {
  constructor() {
    super();
  }
}

class BooleanType extends Type {
  constructor() {
    super();
  }
}

class IntType extends Type {
  constructor() {
    super();
  }
}

class BottomType extends Type {
  constructor() {
    super();
  }
}

class IntersectionType extends Type {
  readonly types: ReadonlySet<Type>;
  constructor(types: ReadonlySet<Type>) {
    super();
    this.types = types;
  }
  formatMeta(seen: Set<Type>) {
    return Array.from(this.types)
      .map(t => t.format(seen))
      .join(" & ");
  }
}

class FreeType extends Type {}

class Store {
  private readonly map: Map<string, Type> = new Map();

  set(name: string, type: Type) {
    this.get(name).subtypeOf(type);
  }

  get(name: string) {
    const curr = this.map.get(name);
    if (curr) return curr;
    const type = new FreeType();
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

  toString(normalized: ReadonlyMap<Type, Type> = new Map()) {
    return `Store {${Array.from(this.map).map(
      ([k, v]) => `${k}: ${normalized.get(v) ?? v}`
    )}}`;
  }

  takeTypes(set: Set<Type>) {
    for (const [_, type] of this.map) {
      set.add(type);
    }
  }
}

type RuleAnalyzer<T> = {
  [key in keyof RuleMap]: (pre: T, node: RuleMap[key], post: T) => void;
};

export class GrammarTypesInfer implements RuleAnalyzer<Store> {
  private readonly grammar: Grammar;
  private readonly stores = new Map<AnyRule, readonly [Store, Store]>();
  private readonly valueTypes = new Map<Assignables, Type>();

  private readonly t = {
    top: new TopType(),
    null: new NullType(),
    string: new StringType(),
    boolean: new BooleanType(),
    int: new IntType(),
    bottom: new BottomType(),
  };

  constructor(grammar: Grammar) {
    this.grammar = grammar;
  }

  private store(rule: AnyRule) {
    let pair = this.stores.get(rule);
    if (pair == null) {
      pair = [new Store(), new Store()];
      this.stores.set(rule, pair);
    }
    return pair;
  }

  private valueType(value: Assignables) {
    let type = this.valueTypes.get(value);
    if (type == null) {
      type = new FreeType();
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
    // TODO this.valueType(node).subtypeOf(NullType.SINGLETON);
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
    this.valueType(node).subtypeOf(
      new ReadonlyObjectType(
        node.fields.map(([k, v]) => [k, this.valueType(v)])
      )
    );
  }

  id(pre: Store, node: IdRule, post: Store) {
    pre.propagateTo(post);
    this.valueType(node).subtypeOf(pre.get(node.id) ?? this.t.bottom);
  }

  int(pre: Store, node: IntRule, post: Store) {
    pre.propagateTo(post);
    this.valueType(node).subtypeOf(this.t.int);
  }

  select(pre: Store, node: SelectRule, post: Store) {
    const [preExpr, postExpr] = this.store(node.parent);
    pre.propagateTo(preExpr);
    this.visit(node.parent);
    //
    postExpr.propagateTo(post);
    this.valueType(node.parent).subtypeOf(
      new ReadonlyObjectType([[node.field, this.valueType(node)]])
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
      postExpr
        .get(node.name)
        .subtypeOf(new ArrayType(this.valueType(node.rule)));
      postExpr.propagateTo(post);
    } else {
      postExpr.propagateToExcept(post, node.name);
      post.set(node.name, this.valueType(node.rule));
    }
  }

  predicate(pre: Store, node: PredicateRule, post: Store) {
    // TODO
  }

  run(rule: RuleDeclaration) {
    const [preRule, postRule] = this.store(rule.rule);

    for (const arg of rule.args) {
      preRule.set(arg, new FreeType());
    }
    for (const local of rule.locals) {
      preRule.set(local, this.t.null);
    }

    this.visit(rule.rule);

    const [preReturn, _] = this.store(rule.return);

    postRule.propagateTo(preReturn);

    this.visit(rule.return);
  }

  visit(node: AnyRule) {
    const [pre, post] = this.store(node);
    this[node.type](pre, node as any, post);
  }

  debug() {
    const normalized = this.simplify();

    console.log("---- SINGLETON TYPES ----");
    for (const [name, type] of Object.entries(this.t)) {
      console.log(name, type.toString());
    }

    console.log("---- STORES ----");
    for (const [rule, [pre, post]] of this.stores) {
      console.log(new GrammarFormatter().visit(rule));
      console.log("PRE:", pre.toString(normalized));
      console.log("POST:", post.toString(normalized));
    }

    console.log("---- VALUES ----");
    for (const [value, type] of this.valueTypes) {
      console.log(
        new GrammarFormatter().visit(value),
        // type.toString(),
        normalized.get(type)?.toString()
      );
    }

    console.log("--------");
  }

  private getAllTypes(): ReadonlySet<Type> {
    const { top, null: nullType, string, boolean, int, bottom } = this.t;
    const types = new Set([top, nullType, string, boolean, int, bottom]);
    for (const type of this.valueTypes.values()) {
      types.add(type);
    }
    for (const [pre, post] of this.stores.values()) {
      pre.takeTypes(types);
      post.takeTypes(types);
    }
    return types;
  }

  // TODO report errors
  simplify(): ReadonlyMap<Type, Type> {
    const normalized = new Map<Type, Type>();
    const normalizing = new Set<Type>();
    const types = this.getAllTypes();
    // const errors = [];

    const normalize = (t: Type): Type | null => {
      // See if this type was already normalized
      const cache = normalized.get(t);
      if (cache) return cache;
      // See if we are trying to normalize this type
      if (normalizing.has(t)) {
        // ?? errors.push(t);
        return null;
      }
      // Register that we are now normalizing the type
      normalizing.add(t);

      const supertypes = new Set(
        Array.from(t.supertypes)
          .map(t => normalize(t))
          .filter((t): t is Type => t != null && t != this.t.top)
      );

      let t2: Type;
      if (t instanceof FreeType) {
        if (supertypes.size === 0) {
          t2 = this.t.top;
        } else if (supertypes.size === 1) {
          t2 = supertypes.values().next().value!!;
        } else if (supertypes.has(this.t.bottom)) {
          t2 = this.t.bottom;
        } else {
          t2 = new IntersectionType(supertypes);
        }
      } else if (t instanceof ArrayType) {
        t2 = new ArrayType(normalize(t.component) ?? t.component);
      } else if (t instanceof ReadonlyObjectType) {
        t2 = new ReadonlyObjectType(
          t.fields.map(([k, v]) => [k, normalize(v) ?? v])
        );
      } else {
        t2 = t;
      }

      // Finish normalization
      normalizing.delete(t);
      normalized.set(t, t2);
      return t2;
    };

    for (const t of types) {
      normalize(t);
    }

    return normalized;
  }
}
