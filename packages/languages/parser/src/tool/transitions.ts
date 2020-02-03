import { Rule } from "./parser/grammar-parser";

export abstract class Transition {
  isEpsilon: boolean;

  constructor() {
    this.isEpsilon = false;
  }

  abstract hashCode(): number;
  abstract equals(other: unknown): boolean;
}

abstract class AbstractEpsilonTransition extends Transition {
  constructor() {
    super();
    this.isEpsilon = true;
  }

  equals(other: unknown): boolean {
    return other === this;
  }

  toString() {
    return `[AbstractEpsilon]`;
  }
}

// For lexer and parser
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

// For lexer: goes to a fragment or lexer rule
// For parser: goes to a parser rule
export class RuleTransition extends Transition {
  rule: Rule;

  constructor(rule: Rule) {
    super();
    this.rule = rule;
  }

  hashCode() {
    return 1;
  }

  equals(other: unknown): boolean {
    return other instanceof RuleTransition && other.rule === this.rule;
  }

  toString() {
    return `[Rule ${this.rule.name}]`;
  }
}

// For lexer and parser
export class PredicateTransition extends AbstractEpsilonTransition {
  hashCode() {
    return 2;
  }

  toString() {
    return `[Predicate]`;
  }
}

// For lexer and parser
export class ActionTransition extends AbstractEpsilonTransition {
  code: string;

  constructor(code: string) {
    super();
    this.code = code;
  }

  hashCode() {
    return 3;
  }

  equals(other: unknown): boolean {
    return other instanceof ActionTransition && other.code === this.code;
  }

  toString() {
    return `[Action]`;
  }
}

// For parser
export class PrecedenceTransition extends AbstractEpsilonTransition {
  hashCode() {
    return 4;
  }

  toString() {
    return `[Precedence]`;
  }
}

export class RangeTransition extends Transition {
  from: number;
  to: number;

  constructor(from: number, to: number) {
    super();
    this.from = from;
    this.to = to;
  }

  hashCode() {
    return 5;
  }

  equals(other: unknown): boolean {
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
  id: number;

  constructor(id: number) {
    super();
    this.id = id;
  }

  hashCode() {
    return 6 * this.id;
  }

  equals(other: unknown): boolean {
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

  equals(other: unknown): boolean {
    return other instanceof EOFTransition;
  }

  toString() {
    return `[EOF]`;
  }
}

export class NamedTransition extends Transition {
  name: string;
  multiple: boolean;
  subTransition: RangeTransition | RuleTransition;

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

  equals(other: unknown): boolean {
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
