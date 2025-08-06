import { intersect } from "../../util/range-utils.ts";
import type { Location } from "../runtime/input.ts";
import {
  sameArgs,
  sameAssignable,
  type ExprRule,
} from "../grammar/grammar-builder.ts";
import { grammarFormatter } from "../grammar/grammar-formatter.ts";

export type AnyTransition =
  | EpsilonTransition
  | CallTransition
  | FieldTransition
  | ActionTransition
  | PredicateTransition
  | RangeTransition
  | ReturnTransition;

export type FieldInfo = Readonly<{
  name: string;
  multiple: boolean;
}>;

export function printFieldInfo(info: FieldInfo | null) {
  if (info) {
    return `${info.name} ${info.multiple ? "+=" : "="} `;
  }
  return "";
}

export abstract class Transition<E extends boolean> {
  readonly isEpsilon: E;
  loc: Location | null;

  constructor(isEpsilon: E) {
    this.isEpsilon = isEpsilon;
    this.loc = null;
  }

  abstract hashCode(): number;
  abstract equals(other: unknown): boolean;
  abstract toString(): string;

  setLoc(loc: Location | null) {
    this.loc = loc;
    return this;
  }
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

export abstract class AssignableTransition extends AbstractNotEpsilonTransition {
  readonly field: FieldInfo | null;

  constructor(field: FieldInfo | null) {
    super();
    this.field = field;
  }

  equals(other: unknown): other is AssignableTransition {
    return (
      other instanceof AssignableTransition &&
      other.field?.name === this.field?.name &&
      other.field?.multiple === this.field?.multiple
    );
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

export class CallTransition extends AssignableTransition {
  readonly ruleName: string;
  readonly args: readonly ExprRule[];

  constructor(
    ruleName: string,
    args: readonly ExprRule[],
    field: FieldInfo | null
  ) {
    super(field);
    this.ruleName = ruleName;
    this.args = args;
  }

  hashCode() {
    return 1;
  }

  override equals(other: unknown): other is CallTransition {
    return (
      other instanceof CallTransition &&
      this.ruleName === other.ruleName &&
      sameArgs(this.args, other.args) &&
      super.equals(other)
    );
  }

  toString() {
    return `[${printFieldInfo(this.field)}Rule ${this.ruleName} (${this.args.map(a => grammarFormatter.visit(a))})]`;
  }
}

export class PredicateTransition extends AbstractEpsilonTransition {
  readonly code: ExprRule;

  constructor(code: ExprRule) {
    super();
    this.code = code;
  }

  hashCode() {
    return 2;
  }

  equals(other: unknown): other is PredicateTransition {
    return (
      other instanceof PredicateTransition &&
      sameAssignable(this.code, other.code)
    );
  }

  toString() {
    return `[Predicate ${grammarFormatter.visit(this.code)}]`;
  }
}

export class ActionTransition extends AssignableTransition {
  readonly code: ExprRule;

  constructor(code: ExprRule, field: FieldInfo | null) {
    super(field);
    this.code = code;
  }

  hashCode() {
    return 4;
  }

  override equals(other: unknown): other is ActionTransition {
    return (
      other instanceof ActionTransition &&
      sameAssignable(this.code, other.code) &&
      super.equals(other)
    );
  }

  toString() {
    return `[${printFieldInfo(this.field)}Action ${grammarFormatter.visit(this.code)}]`;
  }
}

export class RangeTransition extends AssignableTransition {
  readonly from: number;
  readonly to: number;

  constructor(from: number, to: number, field: FieldInfo | null) {
    super(field);
    this.from = from;
    this.to = to;
  }

  hashCode() {
    return 5 * this.from * this.to;
  }

  override equals(other: unknown): other is RangeTransition {
    return (
      other instanceof RangeTransition &&
      other.from === this.from &&
      other.to === this.to &&
      super.equals(other)
    );
  }

  intersects(other: RangeTransition) {
    return intersect(this, other);
  }

  toString() {
    return `[${printFieldInfo(this.field)}Range [${this.from},${this.to}]]`;
  }
}

export class ReturnTransition extends AbstractEpsilonTransition {
  readonly ruleName: string;
  readonly returnCode: ExprRule;

  constructor(ruleName: string, returnCode: ExprRule) {
    super();
    this.ruleName = ruleName;
    this.returnCode = returnCode;
  }

  hashCode() {
    return 6;
  }

  equals(other: unknown): other is ReturnTransition {
    return (
      other instanceof ReturnTransition &&
      this.ruleName === other.ruleName &&
      sameAssignable(this.returnCode, other.returnCode)
    );
  }

  toString() {
    return `[Return ${grammarFormatter.visit(this.returnCode)}]`;
  }
}

export class FieldTransition extends AbstractEpsilonTransition {
  constructor(readonly field: FieldInfo) {
    super();
  }

  hashCode() {
    return 7;
  }

  equals(other: unknown): other is FieldTransition {
    return (
      other instanceof FieldTransition &&
      this.field.name === other.field.name &&
      this.field.multiple === other.field.multiple
    );
  }

  toString() {
    return `[${printFieldInfo(this.field)}$val]`;
  }
}
