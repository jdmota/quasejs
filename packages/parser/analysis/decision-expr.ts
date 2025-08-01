import {
  type ObjectHashEquals,
  equals,
  nonNull,
} from "../../util/miscellaneous.ts";
import { EOF_RANGE } from "../utils/index.ts";
import { FollowStack } from "./follow-stack.ts";

// 1-based index to be used in this.$ff(index)
export function getInFollowStack(follow: FollowStack, index: number) {
  if (index > follow.size) {
    return EOF_RANGE.from;
  }
  let i = follow.size - index;
  let f: FollowStack = follow;
  while (i--) {
    f = nonNull(f.child);
  }
  return f.followID;
}

export type DecisionSingleton = DecisionTestToken | DecisionTestFollow;

export type DecisionExpr = DecisionSingleton | DecisionAnd | DecisionOr;

abstract class AbstractDecision {
  or(this: DecisionExpr, expr: DecisionExpr): DecisionExpr {
    return DecisionOr.create([this, expr]);
  }

  and(this: DecisionExpr, expr: DecisionExpr): DecisionExpr {
    return DecisionAnd.create([this, expr]);
  }
}

abstract class DecisionCompoundExpr
  extends AbstractDecision
  implements ObjectHashEquals
{
  readonly exprs: readonly DecisionExpr[];

  constructor(exprs: DecisionExpr[]) {
    super();
    this.exprs = exprs;
  }

  hashCode(): number {
    return this.exprs.length;
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    if (other instanceof DecisionCompoundExpr) {
      return (
        this.exprs.length === other.exprs.length &&
        this.exprs.every((val, idx) => equals(val, other.exprs[idx]))
      );
    }
    return false;
  }
}

export class DecisionAnd extends DecisionCompoundExpr {
  static create(exprs: DecisionExpr[]) {
    exprs = exprs.flatMap(e => (e instanceof DecisionAnd ? e.exprs : [e]));
    if (exprs.length === 1) {
      return exprs[0];
    }
    return new DecisionAnd(exprs);
  }

  override equals(other: unknown): boolean {
    return other instanceof DecisionAnd && super.equals(other);
  }

  override toString(): string {
    return `(and ${this.exprs.map(e => e.toString()).join(" ")})`;
  }
}

export class DecisionOr extends DecisionCompoundExpr {
  static create(exprs: DecisionExpr[]) {
    exprs = exprs.flatMap(e => (e instanceof DecisionOr ? e.exprs : [e]));
    if (exprs.length === 1) {
      return exprs[0];
    }
    return new DecisionOr(exprs);
  }

  override equals(other: unknown): boolean {
    return other instanceof DecisionOr && super.equals(other);
  }

  override toString(): string {
    return `(or ${this.exprs.map(e => e.toString()).join(" ")})`;
  }
}

export const FALSE = DecisionOr.create([]);
export const TRUE = DecisionAnd.create([]);

export class DecisionTestToken
  extends AbstractDecision
  implements ObjectHashEquals
{
  readonly ll: number;
  readonly from: number;
  readonly to: number;

  constructor(ll: number, from: number, to: number) {
    super();
    this.ll = ll;
    this.from = from;
    this.to = to;
  }

  hashCode(): number {
    return this.ll * (this.from + this.to);
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    if (other instanceof DecisionTestToken) {
      return (
        this.ll === other.ll && this.from === other.from && this.to === other.to
      );
    }
    return false;
  }

  override toString() {
    return `(range ll${this.ll} ${this.from} ${this.to})`;
  }
}

export class DecisionTestFollow
  extends AbstractDecision
  implements ObjectHashEquals
{
  readonly ff: number;
  readonly from: number;
  readonly to: number;

  constructor(ff: number, from: number, to: number) {
    super();
    this.ff = ff;
    this.from = from;
    this.to = to;
  }

  hashCode(): number {
    return this.ff * (this.from + this.to);
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    if (other instanceof DecisionTestFollow) {
      return (
        this.ff === other.ff && this.from === other.from && this.to === other.to
      );
    }
    return false;
  }

  override toString() {
    return `(follow ff${this.ff} ${this.from} ${this.to})`;
  }
}
