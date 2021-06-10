import {
  sameArgs,
  sameAssignable,
  FieldRule,
  sameExpr,
  AnyExpr,
} from "../grammar/grammar-builder";

export type AnyTransition =
  | EpsilonTransition
  | RuleTransition
  | ActionTransition
  | PredicateTransition
  | PrecedenceTransition
  | RangeTransition
  | EOFTransition
  | ReturnTransition
  | FieldTransition;

abstract class Transition<E extends boolean> {
  readonly isEpsilon: E;

  constructor(isEpsilon: E) {
    this.isEpsilon = isEpsilon;
  }

  abstract hashCode(): number;
  abstract equals(other: unknown): boolean;
  abstract toString(): string;
}

abstract class AbstractEpsilonTransition extends Transition<true> {
  constructor() {
    super(true);
  }
}

abstract class AbstractNotEpsilonTransition extends Transition<false> {
  constructor() {
    super(false);
  }
}

export class EpsilonTransition extends AbstractEpsilonTransition {
  hashCode() {
    return 0;
  }

  equals(other: unknown) {
    return other instanceof EpsilonTransition;
  }

  toString() {
    return `[Epsilon]`;
  }
}

export class RuleTransition extends AbstractNotEpsilonTransition {
  readonly ruleName: string;
  readonly args: readonly AnyExpr[];

  constructor(ruleName: string, args: readonly AnyExpr[]) {
    super();
    this.ruleName = ruleName;
    this.args = args;
  }

  hashCode() {
    return 1;
  }

  equals(other: unknown): other is RuleTransition {
    return (
      other instanceof RuleTransition &&
      this.ruleName === other.ruleName &&
      sameArgs(this.args, other.args)
    );
  }

  toString() {
    return `[Rule ${this.ruleName}]`;
  }
}

// TODO
export class PredicateTransition extends AbstractEpsilonTransition {
  hashCode() {
    return 2;
  }

  equals(other: unknown): other is PredicateTransition {
    return other instanceof PredicateTransition && other === this;
  }

  toString() {
    return `[Predicate]`;
  }
}

// TODO
export class PrecedenceTransition extends PredicateTransition {
  hashCode() {
    return 3;
  }

  equals(other: unknown): other is PrecedenceTransition {
    return other instanceof PrecedenceTransition && this === other;
  }

  toString() {
    return `[Precedence]`;
  }
}

export class ActionTransition extends AbstractEpsilonTransition {
  readonly code: AnyExpr;

  constructor(code: AnyExpr) {
    super();
    this.code = code;
  }

  hashCode() {
    return 4;
  }

  equals(other: unknown): other is ActionTransition {
    return other instanceof ActionTransition && sameExpr(this.code, other.code);
  }

  toString() {
    return `[Action]`;
  }
}

export class RangeTransition extends AbstractNotEpsilonTransition {
  readonly from: number;
  readonly to: number;

  constructor(from: number, to: number) {
    super();
    this.from = from;
    this.to = to;
  }

  hashCode() {
    return 5 * this.from * this.to;
  }

  equals(other: unknown): other is RangeTransition {
    return (
      other instanceof RangeTransition &&
      other.from === this.from &&
      other.to === this.to
    );
  }

  toString() {
    return `[Range [${this.from},${this.to}]]`;
  }
}

export class EOFTransition extends RangeTransition {
  constructor() {
    super(-1, -1);
  }

  toString() {
    return `[EOF]`;
  }
}

export class ReturnTransition extends AbstractEpsilonTransition {
  readonly returnCode: AnyExpr | null;

  constructor(returnCode: AnyExpr | null) {
    super();
    this.returnCode = returnCode;
  }

  hashCode() {
    return 6;
  }

  equals(other: unknown): other is ReturnTransition {
    return (
      other instanceof ReturnTransition &&
      (this.returnCode == null || other.returnCode == null
        ? this.returnCode === other.returnCode
        : sameExpr(this.returnCode, other.returnCode))
    );
  }

  toString() {
    return `[Return]`;
  }
}

export class FieldTransition extends AbstractEpsilonTransition {
  readonly node: FieldRule;

  constructor(node: FieldRule) {
    super();
    this.node = node;
  }

  hashCode() {
    return 7 * this.node.name.length;
  }

  equals(other: unknown): other is FieldTransition {
    return (
      other instanceof FieldTransition &&
      this.node.name === other.node.name &&
      this.node.multiple === other.node.multiple &&
      sameAssignable(this.node.rule, other.node.rule)
    );
  }

  toString() {
    return `[${this.node.name}${this.node.multiple ? "+=" : ""}...]`;
  }
}
