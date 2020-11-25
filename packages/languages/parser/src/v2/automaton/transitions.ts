export abstract class Transition {
  readonly isEpsilon: boolean;

  constructor(isEpsilon: boolean = false) {
    this.isEpsilon = isEpsilon;
  }

  abstract hashCode(): number;
  abstract equals(other: unknown): boolean;
  abstract toString(): string;
}

abstract class AbstractEpsilonTransition extends Transition {
  constructor() {
    super(true);
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

export class RuleTransition extends Transition {
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

export class RangeTransition extends Transition {
  readonly from: number;
  readonly to: number;

  constructor(from: number, to: number) {
    super();
    this.from = from;
    this.to = to;
  }

  hashCode() {
    return 5;
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

export class TokenFinalTransition extends AbstractEpsilonTransition {
  readonly id: number;

  constructor(id: number) {
    super();
    this.id = id;
  }

  hashCode() {
    return 6 * this.id;
  }

  equals(other: unknown): other is TokenFinalTransition {
    return other instanceof TokenFinalTransition && other.id === this.id;
  }

  toString() {
    return `[TokenFinal ${this.id}]`;
  }
}

export class EOFTransition extends Transition {
  hashCode() {
    return 7;
  }

  equals(other: unknown): other is EOFTransition {
    return other instanceof EOFTransition;
  }

  toString() {
    return `[EOF]`;
  }
}

export class NamedTransition extends Transition {
  readonly name: string;
  readonly multiple: boolean;
  readonly subTransition: RangeTransition | RuleTransition;

  constructor(
    name: string,
    multiple: boolean,
    subTransition: RangeTransition | RuleTransition
  ) {
    super();
    this.name = name;
    this.multiple = multiple;
    this.subTransition = subTransition;
  }

  hashCode() {
    return 8 * this.subTransition.hashCode();
  }

  equals(other: unknown): other is NamedTransition {
    return (
      other instanceof NamedTransition &&
      other.name === this.name &&
      other.multiple === this.multiple &&
      other.subTransition.equals(this.subTransition)
    );
  }

  toString() {
    return `[${this.name}=${this.subTransition.toString()}]`;
  }
}
