import { AnyTransition } from "../automaton/transitions.ts";
import { ObjectHashEquals, assertion, unreachable } from "../utils/index.ts";
import { MapKeyToSet, SpecialSet } from "../utils/map-key-to-set.ts";
import { MapRangeToSpecialSet } from "../utils/map-range-to-set.ts";
import {
  DecisionExpr,
  DecisionTestFollow,
  DecisionTestToken,
  FALSE,
  TRUE,
} from "./decision-expr.ts";
import { EOF_RANGE, IMPOSSIBLE_RANGE, Range } from "../utils/range-utils.ts";
import { FollowInfoDB } from "../grammar/follow-info.ts";
import { MapKeyToValue } from "../utils/map-key-to-value.ts";
import { DEBUG } from "./analysis-debug.ts";
import { IAnalyzer } from "./analysis-reference.ts";

type GotoDecision<P> = Readonly<{
  desc: P | null;
  gotos: Iterable<AnyTransition>;
}>;

type DecisionNodeNoAdd<P extends ObjectHashEquals> = Omit<
  DecisionNode<P>,
  "add"
>;

class DecisionNode<P extends ObjectHashEquals>
  implements SpecialSet<GotoDecision<P>>
{
  readonly parent: DecisionTree<P>;
  private readonly gotos: MapKeyToSet<AnyTransition, P | null>;
  private readonly gotos2: MapKeyToSet<P | null, AnyTransition>;
  private nextTree: DecisionTree<P> | null;
  //
  readonly decision: DecisionExpr;

  constructor(parent: DecisionTree<P>, decision: DecisionExpr) {
    this.parent = parent;
    this.gotos = new MapKeyToSet();
    this.gotos2 = new MapKeyToSet();
    this.nextTree = null;
    this.decision = decision;
  }

  getGotos(): readonly AnyTransition[] {
    return Array.from(this.gotos).map(e => e[0]);
  }

  hasGoto(t: AnyTransition) {
    return this.gotos.get(t).size > 0;
  }

  add({ desc, gotos }: GotoDecision<P>) {
    assertion(this.nextTree === null);
    for (const goto of gotos) {
      this.gotos.addOne(goto, desc);
    }
    this.gotos2.add(desc, gotos);
    return this;
  }

  gotosNumber() {
    return this.gotos.size;
  }

  isAmbiguous() {
    return this.gotos.size > 1;
  }

  *[Symbol.iterator]() {
    for (const [desc, gotos] of this.gotos2) {
      yield { desc, gotos };
    }
  }

  getNextTree() {
    return this.nextTree;
  }

  ensureNextTokenTree() {
    assertion(!this.nextTree);
    return (this.nextTree = new DecisionTokenTree(this));
  }

  ensureNextFollowTree() {
    assertion(!this.nextTree);
    return (this.nextTree = new DecisionFollowTree(this));
  }

  toString() {
    return `(decision ${this.decision.toString()} (${this.getGotos()
      .map(t => t.toString())
      .join(" ")}))`;
  }
}

abstract class AbstractDecisionTree<P extends ObjectHashEquals> {
  private readonly map: MapRangeToSpecialSet<GotoDecision<P>, DecisionNode<P>>;
  private readonly gotos: MapKeyToValue<AnyTransition, boolean>;
  readonly owner: DecisionNode<P> | null;

  constructor(
    owner: DecisionNode<P> | null,
    fn: (from: number, to: number) => DecisionNode<P>
  ) {
    this.owner = owner;
    this.gotos = new MapKeyToValue();
    this.map = new MapRangeToSpecialSet(fn);
  }

  hasDecision(t: AnyTransition) {
    return this.gotos.get(t) === true;
  }

  hasDecisions() {
    return this.gotos.size > 0;
  }

  decisions() {
    return this.gotos.size;
  }

  protected addRange(
    from: number,
    to: number,
    gotos: readonly AnyTransition[] | ReadonlySet<AnyTransition>,
    desc: P | null
  ) {
    let hasGotos = false;
    for (const goto of gotos) {
      this.gotos.set(goto, true);
      hasGotos = true;
    }
    if (hasGotos) {
      this.map.addRange(from, to, [
        {
          gotos,
          desc,
        },
      ]);
    }
  }

  /*addAny(analyzer: IAnalyzer<P>, gotos: readonly AnyTransition[]) {
    const range = analyzer.getAnyRange();
    this.addRange(range.from, range.to, gotos, null);
  }*/

  addEof(gotos: readonly AnyTransition[] | ReadonlySet<AnyTransition>) {
    this.addRange(EOF_RANGE.from, EOF_RANGE.to, gotos, null);
  }

  ensureDecisions(gotos: readonly AnyTransition[]) {
    this.addRange(
      IMPOSSIBLE_RANGE.from,
      IMPOSSIBLE_RANGE.to,
      gotos.filter(g => !this.hasDecision(g)),
      null
    );
    assertion(gotos.length === this.decisions());
    return this;
  }

  *iterate(): Iterable<DecisionNodeNoAdd<P>> {
    for (const [_, decision] of this.map) {
      yield decision;
    }
  }

  private worthItCache: boolean | null = null;

  private _worthIt() {
    if (!this.owner) {
      return true;
    }
    const gotos = this.owner.gotosNumber();
    for (const decision of this.iterate()) {
      if (gotos > decision.gotosNumber()) {
        return true;
      }
      if (decision.getNextTree()?.worthIt()) {
        return true;
      }
      if (DEBUG.worthIt) {
        return true;
      }
    }
    return false;
  }

  worthIt() {
    return this.worthItCache ?? (this.worthItCache = this._worthIt());
  }
}

export class DecisionTokenTree<
  P extends ObjectHashEquals,
> extends AbstractDecisionTree<P> {
  readonly ll: number;

  constructor(owner: DecisionNode<P> | null) {
    super(
      owner,
      (from, to) =>
        new DecisionNode(this, new DecisionTestToken(this.ll, from, to))
    );
    this.ll = owner
      ? owner.parent instanceof DecisionTokenTree
        ? owner.parent.ll + 1
        : unreachable()
      : 1;
  }

  addDecision(
    range: Range,
    gotos: readonly AnyTransition[] | ReadonlySet<AnyTransition>,
    desc: P
  ) {
    this.addRange(range.from, range.to, gotos, desc);
  }
}

export class DecisionFollowTree<
  P extends ObjectHashEquals,
> extends AbstractDecisionTree<P> {
  readonly ff: number;

  constructor(owner: DecisionNode<P>) {
    super(
      owner,
      (from, to) =>
        new DecisionNode(this, new DecisionTestFollow(this.ff, from, to))
    );
    this.ff =
      owner?.parent instanceof DecisionFollowTree ? owner.parent.ff + 1 : 1;
  }

  addDecision(
    rule: string,
    followDB: FollowInfoDB,
    followID: number | null,
    gotos: readonly AnyTransition[] | ReadonlySet<AnyTransition>,
    desc: P
  ) {
    if (followID != null) {
      this.addRange(followID, followID, gotos, desc);
    } else {
      const ids = followDB.getIdRangeByIndex(rule, this.ff);
      for (const id of ids) {
        this.addRange(id, id, gotos, desc);
      }
    }
  }
}

export type DecisionTree<P extends ObjectHashEquals> =
  | DecisionTokenTree<P>
  | DecisionFollowTree<P>;

export type DecisionTreeNoAdd<P extends ObjectHashEquals> = Omit<
  DecisionTree<P>,
  "addDecision"
>;

export class InvertedDecisionTree<P extends ObjectHashEquals> {
  private readonly map: MapKeyToValue<AnyTransition, DecisionExpr>;
  compatibleWithSwitch: boolean;
  ambiguities: Readonly<{
    decision: DecisionNodeNoAdd<P>;
    condition: DecisionExpr;
  }>[];
  maxLL: number;
  maxFF: number;

  constructor() {
    this.map = new MapKeyToValue();
    this.compatibleWithSwitch = true;
    this.ambiguities = [];
    this.maxLL = 0;
    this.maxFF = 0;
  }

  get(goto: AnyTransition): DecisionExpr {
    return this.map.get(goto) ?? FALSE;
  }

  add(decision: DecisionNodeNoAdd<P>) {
    const condition = InvertedDecisionTree.decisionToTest(decision);

    for (const { gotos } of decision) {
      for (const goto of gotos) {
        this.map.update(goto, old => (old ? old.or(condition) : condition));
      }
    }

    this.compatibleWithSwitch &&=
      condition instanceof DecisionTestToken && condition.from === condition.to;

    if (decision.parent instanceof DecisionTokenTree) {
      this.maxLL = Math.max(this.maxLL, decision.parent.ll);
    } else {
      this.maxFF = Math.max(this.maxFF, decision.parent.ff);
    }

    if (decision.isAmbiguous()) {
      this.ambiguities.push({ decision, condition });
    }
  }

  static decisionToTest<P extends ObjectHashEquals>(
    decision: DecisionNodeNoAdd<P>
  ): DecisionExpr {
    const parent = decision.parent.owner;
    const parentCondition = parent
      ? InvertedDecisionTree.decisionToTest(parent)
      : TRUE;
    return parentCondition.and(decision.decision);
  }
}
