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

  constructor(ruleName: string) {
    super();
    this.ruleName = ruleName;
  }

  hashCode() {
    return 1;
  }

  equals(other: unknown): other is RuleTransition {
    return other instanceof RuleTransition && other.ruleName === this.ruleName;
  }

  toString() {
    return `[Rule ${this.ruleName}]`;
  }
}

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

export class ActionTransition extends AbstractEpsilonTransition {
  readonly code: string;

  constructor(code: string) {
    super();
    this.code = code;
  }

  hashCode() {
    return 3;
  }

  equals(other: unknown): other is ActionTransition {
    return other instanceof ActionTransition && other.code === this.code;
  }

  toString() {
    return `[Action]`;
  }
}

export class PrecedenceTransition extends AbstractEpsilonTransition {
  hashCode() {
    return 4;
  }

  equals(other: unknown): other is PrecedenceTransition {
    return other instanceof PrecedenceTransition && other === this;
  }

  toString() {
    return `[Precedence]`;
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
  constructor() {
    super();
  }

  hashCode() {
    return 6;
  }

  equals(other: unknown): other is ReturnTransition {
    return other instanceof ReturnTransition;
  }

  toString() {
    return `[Return]`;
  }
}

export class FieldTransition extends AbstractEpsilonTransition {
  readonly name: string;
  readonly multiple: boolean;

  constructor(name: string, multiple: boolean) {
    super();
    this.name = name;
    this.multiple = multiple;
  }

  hashCode() {
    return 7 * this.name.length;
  }

  equals(other: unknown): other is FieldTransition {
    return (
      other instanceof FieldTransition &&
      other.name === this.name &&
      other.multiple === this.multiple
    );
  }

  toString() {
    return `[${this.name}${this.multiple ? "+=" : ""}...]`;
  }
}
