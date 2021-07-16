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

abstract class Type {
  readonly supertypes = new Set<Type>();
  subtypeOf(other: Type) {
    this.supertypes.add(other);
  }
}

class ObjectType extends Type {
  readonly fields: readonly (readonly [string, Type])[];
  constructor(fields: readonly (readonly [string, Type])[]) {
    super();
    this.fields = fields;
  }
}

class TopType extends Type {
  static SINGLETON = new TopType();
  private constructor() {
    super();
  }
}

class NullType extends Type {
  static SINGLETON = new NullType();
  private constructor() {
    super();
  }
}

class BooleanType extends Type {
  static SINGLETON = new BooleanType();
  private constructor() {
    super();
  }
}

class IntType extends Type {
  static SINGLETON = new IntType();
  private constructor() {
    super();
  }
}

class BottomType extends Type {
  static SINGLETON = new BottomType();
  private constructor() {
    super();
  }
}

class FreeType extends Type {}

class Store {
  private readonly map: Map<string, Type> = new Map();

  constructor(names: readonly string[]) {
    for (const name of names) {
      this.map.set(name, new FreeType());
    }
  }

  get(name: string) {
    return this.map.get(name) || BottomType.SINGLETON;
  }

  propagateTo(other: Store) {
    for (const [name, type] of this.map) {
      type.subtypeOf(other.get(name));
    }
  }
}

type RuleAnalyzer<T> = {
  [key in keyof RuleMap]: (pre: T, node: RuleMap[key], post: T) => void;
};

class GrammarVisitor implements RuleAnalyzer<Store> {
  private readonly rule: RuleDeclaration;
  private readonly stores = new Map<AnyRule, Store>();
  private readonly valueTypes = new Map<Assignables, Type>();

  readonly returnType = new FreeType();
  readonly argTypes: readonly {
    readonly name: string;
    readonly type: Type;
  }[];

  constructor(rule: RuleDeclaration) {
    this.rule = rule;
    this.argTypes = rule.args.map(name => ({
      name,
      type: new FreeType(),
    }));
  }

  private store(rule: AnyRule) {
    let store = this.stores.get(rule);
    if (store == null) {
      store = new Store(this.rule.locals);
      this.stores.set(rule, store);
    }
    return store;
  }

  private valueType(value: Assignables) {
    let type = this.valueTypes.get(value);
    if (type == null) {
      type = new FreeType();
      this.valueTypes.set(value, type);
    }
    return type;
  }

  seq(pre: Store, node: SeqRule, post: Store) {
    let lastPre = pre;
    for (let i = 0; i < node.rules.length; i++) {
      const thisPre = lastPre;
      const thisPost = i === node.rules.length - 1 ? post : new Store([]);
      this.visit(thisPre, node.rules[i], thisPost);
      lastPre = thisPost;
    }
  }

  choice(pre: Store, node: ChoiceRule, post: Store) {
    for (const n of node.rules) {
      this.visit(pre, n, post);
    }
  }

  repeat(pre: Store, node: RepeatRule, post: Store) {
    // May run 0 times
    pre.propagateTo(post);
    // May run 1 or more times
    this.visit(pre, node.rule, post);
    post.propagateTo(pre);
  }

  repeat1(pre: Store, node: Repeat1Rule, post: Store) {
    // Runs 1 or more times
    this.visit(pre, node.rule, post);
    post.propagateTo(pre);
  }

  optional(pre: Store, node: OptionalRule, post: Store) {
    // May run 0 times
    pre.propagateTo(post);
    // May run 1 time
    this.visit(pre, node.rule, post);
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
    // TODO
  }

  id(pre: Store, node: IdRule, post: Store) {
    pre.propagateTo(post);
    this.valueType(node).subtypeOf(pre.get(node.id));
  }

  int(pre: Store, node: IntRule, post: Store) {
    pre.propagateTo(post);
    // TODO
  }

  select(pre: Store, node: SelectRule, post: Store) {
    const middlePost = new Store([]);
    this.visit(pre, node.parent, middlePost);
    //
    middlePost.propagateTo(post);
    this.valueType(node.parent).subtypeOf(
      new ObjectType([[node.field, this.valueType(node)]])
    );
  }

  call(pre: Store, node: CallRule, post: Store) {
    // TODO
  }

  call2(pre: Store, node: Call2Rule, post: Store) {
    // TODO
  }

  field(pre: Store, node: FieldRule, post: Store) {
    // TODO
  }

  predicate(pre: Store, node: PredicateRule, post: Store) {
    // TODO
  }

  run(rule: RuleDeclaration) {
    const pre = new Store([]); // TODO
    const post = new Store([]); // TODO
    this.visit(pre, rule.rule, post);
  }

  visit(pre: Store, node: AnyRule, post: Store) {
    this[node.type](pre, node as any, post);
  }
}
