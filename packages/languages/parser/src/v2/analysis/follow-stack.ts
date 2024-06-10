import { FollowInfo } from "../grammar/follow-info.ts";
import { ObjectHashEquals, equals } from "../utils/index.ts";
import { IAnalyzer } from "./analysis-reference.ts";

export class FollowStack implements ObjectHashEquals {
  readonly info: FollowInfo;
  readonly child: FollowStack | null;
  readonly llPhase: number;
  readonly size: number;
  private cachedHashCode: number;

  constructor(
    analyzer: IAnalyzer<any>,
    child: FollowStack | null,
    info: FollowInfo
  ) {
    this.info = info;
    this.child = child;
    this.llPhase = analyzer.getLLState();
    this.size = child ? child.size + 1 : 1;
    this.cachedHashCode = 0;
  }

  hashCode(): number {
    if (this.cachedHashCode === 0) {
      this.cachedHashCode =
        (this.info.id + 1) *
        this.size *
        (this.child ? this.child.hashCode() : 1) *
        (this.llPhase + 1);
    }
    return this.cachedHashCode;
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    if (other instanceof FollowStack) {
      return (
        this.info.id === other.info.id &&
        this.llPhase === other.llPhase &&
        this.size === other.size &&
        equals(this.child, other.child)
      );
    }
    return false;
  }

  toString() {
    const { child } = this;
    return `${this.info.rule}${child ? `,${child}` : ""}`;
  }
}
