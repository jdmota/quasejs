import { DFA } from "../optimizer/abstract-optimizer";
import { DState } from "../automaton/state";
import { expect, never } from "../utils";
import { AnyExpr, RuleDeclaration } from "./grammar-builder";
import {
  AnyTransition,
  EpsilonTransition,
  RuleTransition,
  PredicateTransition,
  PrecedenceTransition,
  ActionTransition,
  RangeTransition,
  ReturnTransition,
  FieldTransition,
} from "../automaton/transitions";

class Type {
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

const TOP = new Type();

const NULL = new Type();
NULL.subtypeOf(TOP);

const BOTTOM = new Type();
BOTTOM.subtypeOf(TOP);
BOTTOM.subtypeOf(NULL);

class Store {
  private readonly map: Map<string, Type> = new Map();

  constructor(names: readonly string[]) {
    for (const name of names) {
      this.map.set(name, new Type());
    }
  }

  get(name: string) {
    return this.map.get(name) || BOTTOM;
  }

  propagateTo(other: Store) {
    for (const [name, type] of this.map) {
      type.subtypeOf(other.get(name));
    }
  }
}

type RuleWithAutomaton = {
  readonly rule: RuleDeclaration;
  readonly automaton: DFA<DState>;
};

type RuleWithAutomatonAndTypes = {
  readonly rule: RuleDeclaration;
  readonly automaton: DFA<DState>;
  readonly argTypes: readonly Type[];
  readonly returnType: Type;
  readonly locals: readonly string[];
};

abstract class AutomatonVisitor<T, R extends RuleWithAutomaton> {
  private readonly seen = new Set<DState>();
  protected readonly rule: R;

  constructor(rule: R) {
    this.rule = rule;
  }

  abstract fn(
    preState: DState,
    transition: AnyTransition,
    postState: DState
  ): void;

  abstract run(): T;

  protected visitState(state: DState) {
    if (this.seen.has(state)) return;
    this.seen.add(state);

    for (const [transition, dest] of state) {
      this.fn(state, transition, dest);
      this.visitState(dest);
    }
  }
}

class LocalsCollector extends AutomatonVisitor<
  readonly string[],
  RuleWithAutomaton
> {
  private readonly locals = new Set<string>();

  fn(preState: DState, transition: AnyTransition, postState: DState): void {
    if (transition instanceof ActionTransition) {
      const { code } = transition;
      if (code.type == "fieldExpr") {
        this.locals.add(code.name);
      }
    } else if (transition instanceof FieldTransition) {
      this.locals.add(transition.node.name);
    } else {
      expect<
        | EpsilonTransition
        | RuleTransition
        | PredicateTransition
        | PrecedenceTransition
        | RangeTransition
        | ReturnTransition
      >(transition);
    }
  }

  run(): readonly string[] {
    this.visitState(this.rule.automaton.start);
    return Array.from(this.locals);
  }
}

class RuleAnalyzer extends AutomatonVisitor<void, RuleWithAutomaton> {
  private readonly stateToStore = new Map<DState, Store>();
  private readonly exprTypes = new Map<AnyExpr, Type>();
  private readonly returnType = new Type();
  private readonly argTypes: readonly {
    readonly name: string;
    readonly type: Type;
  }[];
  private readonly fields: readonly string[];
  private readonly locals: readonly string[];

  constructor(rule: RuleWithAutomaton) {
    super(rule);
    this.fields = new LocalsCollector(rule).run();
    this.argTypes = rule.rule.args.map(name => ({ name, type: new Type() }));
    this.locals = [...rule.rule.args, ...this.fields];
  }

  private store(state: DState) {
    let store = this.stateToStore.get(state);
    if (store == null) {
      store = new Store(this.locals);
      this.stateToStore.set(state, store);
    }
    return store;
  }

  private exprType(expr: AnyExpr) {
    let type = this.exprTypes.get(expr);
    if (type == null) {
      type = new Type();
      this.exprTypes.set(expr, type);
    }
    return type;
  }

  fn(preState: DState, transition: AnyTransition, postState: DState): void {
    const locals = this.locals;
    const pre = this.store(preState);
    const post = this.store(postState);
    if (transition instanceof EpsilonTransition) {
      pre.propagateTo(post);
    } else if (transition instanceof RangeTransition) {
      pre.propagateTo(post);
    } else if (transition instanceof PredicateTransition) {
      pre.propagateTo(post);
    } else if (transition instanceof PrecedenceTransition) {
      pre.propagateTo(post);
    } else if (transition instanceof RuleTransition) {
      // TODO analyze
    } else if (transition instanceof ActionTransition) {
      // TODO analyze code expr
    } else if (transition instanceof ReturnTransition) {
      // TODO analyze code expr
      const { returnCode } = transition;
      if (returnCode == null) {
        this.returnType.subtypeOf(
          new ObjectType(locals.map(id => [id, pre.get(id)]))
        );
      } else {
        this.returnType.subtypeOf(this.exprType(returnCode));
      }
    } else if (transition instanceof FieldTransition) {
      // TODO analyze
    } else {
      never(transition);
    }
  }

  run() {
    const argTypes = this.argTypes;
    const start = this.rule.automaton.start;
    const store = this.store(start);

    for (let i = 0; i < argTypes.length; i++) {
      const { name, type } = argTypes[i];
      store.get(name).subtypeOf(type);
    }

    this.visitState(start);
  }
}

export class GrammarTypesInfer {
  private readonly rules: readonly RuleWithAutomaton[];

  constructor(rules: readonly RuleWithAutomaton[]) {
    this.rules = rules;
  }

  infer(rule: RuleWithAutomatonAndTypes) {
    new RuleAnalyzer(rule).run();
  }
}
