import type { Location } from "../runtime/input";
import { DFA } from "../optimizer/abstract-optimizer";
import { DState } from "../automaton/state";
import { expect, never } from "../utils";
import {
  AnyExpr,
  Assignables,
  CallExpr,
  FieldExpr,
  IdExpr,
  ObjectExpr,
  RuleDeclaration,
  SelectExpr,
} from "./grammar-builder";
import {
  AnyTransition,
  EpsilonTransition,
  CallTransition,
  PredicateTransition,
  ActionTransition,
  RangeTransition,
  ReturnTransition,
  FieldTransition,
} from "../automaton/transitions";

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

abstract class ExprVisitor {
  id(expr: IdExpr) {}

  /*field(expr: FieldExpr) {
    this.run(expr.expr);
  }*/

  select(expr: SelectExpr) {
    this.run(expr.parent);
  }

  call(expr: CallExpr) {
    for (const arg of expr.args) {
      this.run(arg);
    }
  }

  object(expr: ObjectExpr) {
    for (const [name, field] of expr.fields) {
      this.run(field);
    }
  }

  run(expr: AnyExpr) {
    switch (expr.type) {
      case "idExpr":
        this.id(expr);
        break;
      /*case "fieldExpr":
        this.field(expr);
        break;*/
      case "selectExpr":
        this.select(expr);
        break;
      case "callExpr":
        this.call(expr);
        break;
      case "objectExpr":
        this.object(expr);
        break;
      default:
        never(expr);
    }
  }
}

export class LocalsCollector extends AutomatonVisitor<
  readonly string[],
  RuleWithAutomaton
> {
  private readonly locals = new Set<string>();

  fn(preState: DState, transition: AnyTransition, postState: DState): void {
    /*if (transition instanceof ActionTransition) {
      const { code } = transition;
      if (code.type == "fieldExpr") {
        this.locals.add(code.name);
      }
    } else */
    if (transition instanceof FieldTransition) {
      this.locals.add(transition.name);
    } else {
      expect<
        | ActionTransition
        | EpsilonTransition
        | CallTransition
        | PredicateTransition
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

// TODO
class ExprAnalyzer extends ExprVisitor {
  private readonly exprTypes = new Map<AnyExpr, Type>();

  exprType(expr: AnyExpr) {
    let type = this.exprTypes.get(expr);
    if (type == null) {
      type = new FreeType();
      this.exprTypes.set(expr, type);
    }
    return type;
  }
}

class RuleAnalyzer extends AutomatonVisitor<void, RuleWithAutomaton> {
  readonly returnType = new FreeType();
  readonly argTypes: readonly {
    readonly name: string;
    readonly type: Type;
  }[];

  private readonly exprAnalyzer = new ExprAnalyzer();
  private readonly stateToStore = new Map<DState, Store>();
  private readonly fields: readonly string[];
  private readonly locals: readonly string[];
  private readonly inferrer: GrammarTypesInfer;

  constructor(inferrer: GrammarTypesInfer, rule: RuleWithAutomaton) {
    super(rule);
    this.inferrer = inferrer;
    this.fields = new LocalsCollector(rule).run();
    this.argTypes = rule.rule.args.map(name => ({
      name,
      type: new FreeType(),
    }));
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

  private transitionType(transition: AnyTransition) {
    if (transition instanceof EpsilonTransition) {
      return NullType.SINGLETON;
    } else if (transition instanceof RangeTransition) {
      return new FreeType(); // TODO
    } else if (transition instanceof CallTransition) {
      const ruleAnalyzer = this.inferrer.rules.get(transition.ruleName);
      if (ruleAnalyzer) {
        return ruleAnalyzer.returnType;
      } else {
        return BottomType.SINGLETON;
      }
    } else if (transition instanceof PredicateTransition) {
      throw new Error("");
    } else if (transition instanceof ActionTransition) {
      return this.exprAnalyzer.exprType(transition.code);
    } else if (transition instanceof ReturnTransition) {
      throw new Error("");
    } else if (transition instanceof FieldTransition) {
      throw new Error("");
    } else {
      never(transition);
    }
  }

  fn(preState: DState, transition: AnyTransition, postState: DState): void {
    const locals = this.locals;
    const pre = this.store(preState);
    const post = this.store(postState);
    if (transition instanceof EpsilonTransition) {
      pre.propagateTo(post);
    } else if (transition instanceof RangeTransition) {
      pre.propagateTo(post);
    } else if (transition instanceof CallTransition) {
      const ruleAnalyzer = this.inferrer.rules.get(transition.ruleName);
      if (ruleAnalyzer) {
        const expectedArgs = ruleAnalyzer.argTypes;
        const actualArgs = transition.args;
        for (let i = 0; i < actualArgs.length; i++) {
          const arg = actualArgs[i];
          this.exprAnalyzer.run(arg);
          this.exprAnalyzer
            .exprType(arg)
            .subtypeOf(expectedArgs[i]?.type ?? TopType.SINGLETON);
        }
        if (expectedArgs.length !== actualArgs.length) {
          this.inferrer.addError(
            `Rule ${transition.ruleName} expects ${expectedArgs.length} arguments, got ${actualArgs.length}`,
            transition.loc
          );
        }
      } else {
        this.inferrer.addError(
          `Rule ${transition.ruleName} is not defined`,
          transition.loc
        );
      }
    } else if (transition instanceof PredicateTransition) {
      this.exprAnalyzer.run(transition.code);
      this.exprAnalyzer
        .exprType(transition.code)
        .subtypeOf(BooleanType.SINGLETON);
      pre.propagateTo(post);
    } else if (transition instanceof ActionTransition) {
      this.exprAnalyzer.run(transition.code);
    } else if (transition instanceof ReturnTransition) {
      const { returnCode } = transition;
      if (returnCode == null) {
        this.returnType.subtypeOf(
          new ObjectType(locals.map(id => [id, pre.get(id)]))
        );
      } else {
        this.exprAnalyzer.run(returnCode);
        this.returnType.subtypeOf(this.exprAnalyzer.exprType(returnCode));
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
  private readonly errors: (readonly [string, Location | null])[];
  readonly rules: ReadonlyMap<string, RuleAnalyzer>;

  constructor(rules: readonly RuleWithAutomaton[]) {
    this.errors = [];
    this.rules = new Map(
      rules.map(rule => [rule.rule.name, new RuleAnalyzer(this, rule)])
    );
  }

  addError(message: string, loc: Location | null) {
    this.errors.push([message, loc]);
  }

  infer(rule: RuleWithAutomatonAndTypes) {}
}
