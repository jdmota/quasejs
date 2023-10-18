import { DState } from "../automaton/state";
import {
  AnyTransition,
  CallTransition,
  RangeTransition,
  ReturnTransition,
} from "../automaton/transitions";
import { MapKeyToValue } from "../utils/map-key-to-value";
import { MapKeyToSet } from "../utils/map-key-to-set";
import { assertion, equals, ObjectHashEquals } from "../utils";
import { MapRangeToSpecialSet, SpecialSet } from "../utils/map-range-to-set";
import { Range } from "../utils/range-utils";
import { ParserGenerator } from "../generators/generate-parser";
import { Grammar } from "../grammar/grammar";
import { Declaration } from "../grammar/grammar-builder";
import { FollowInfo, FollowInfoDB } from "../grammar/follow-info";

type GotoDecision = Readonly<{
  goto: AnyTransition;
  stack: StackFrame;
}>;

type DecisionNodeNoAdd = Omit<DecisionNode, "add">;

class DecisionNode implements SpecialSet<GotoDecision> {
  private readonly gotos: MapKeyToSet<AnyTransition, StackFrame>;
  private nextTree: DecisionTree | null;

  constructor(
    readonly parent: DecisionTree,
    readonly follow: FollowStack | null,
    readonly range: Range
  ) {
    this.gotos = new MapKeyToSet();
    this.nextTree = null;
  }

  getGotos(): readonly AnyTransition[] {
    return Array.from(this.gotos).map(e => e[0]);
  }

  hasGoto(t: AnyTransition) {
    return this.gotos.get(t).size > 0;
  }

  add({ goto, stack }: GotoDecision) {
    assertion(this.nextTree === null);
    this.gotos.addOne(goto, stack);
    return this;
  }

  gotosNumber() {
    return this.gotos.size;
  }

  isAmbiguous() {
    return this.gotos.size > 1;
  }

  iterate() {
    return this.gotos[Symbol.iterator]();
  }

  *[Symbol.iterator]() {
    for (const [goto, set] of this.gotos) {
      for (const stack of set) {
        yield { goto, stack };
      }
    }
  }

  getNextTree() {
    return this.nextTree;
  }

  ensureNextTree() {
    return this.nextTree ?? (this.nextTree = new DecisionTree(this));
  }

  toExpr() {
    return DecisionAnd.create([
      new DecisionTestRange(this.parent.ll, this.range),
      this.follow ? new DecisionTestFollow(this.follow) : TRUE,
    ]);
  }
}

export type DecisionExpr =
  | DecisionTestRange
  | DecisionTestFollow
  | DecisionAnd
  | DecisionOr;

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
}

export const FALSE = DecisionOr.create([]);
export const TRUE = DecisionAnd.create([]);

export class DecisionTestRange
  extends AbstractDecision
  implements ObjectHashEquals
{
  readonly ll: number;
  readonly range: Range;

  constructor(ll: number, range: Range) {
    super();
    this.ll = ll;
    this.range = range;
  }

  hashCode(): number {
    return this.ll * (this.range.from + this.range.to);
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    if (other instanceof DecisionTestRange) {
      return (
        this.ll === other.ll &&
        this.range.from === other.range.from &&
        this.range.to === other.range.to
      );
    }
    return false;
  }
}

export class DecisionTestFollow
  extends AbstractDecision
  implements ObjectHashEquals
{
  readonly follow: FollowStack;

  constructor(follow: FollowStack) {
    super();
    this.follow = follow;
  }

  hashCode(): number {
    return this.follow.hashCode();
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    if (other instanceof DecisionTestFollow) {
      return equals(this.follow, other.follow);
    }
    return false;
  }
}

type DecisionTreeNoAdd = Omit<DecisionTree, "addDecision">;

class DecisionTree {
  private readonly map: MapKeyToValue<
    FollowStack | null,
    MapRangeToSpecialSet<GotoDecision, DecisionNode>
  >;
  readonly ll: number;
  private nonEmpty: boolean;

  constructor(readonly owner: DecisionNode | null) {
    this.map = new MapKeyToValue();
    this.ll = owner ? owner.parent.ll + 1 : 1;
    this.nonEmpty = false;
  }

  hasDecisions() {
    return this.nonEmpty;
  }

  addDecision(
    follow: FollowStack | null,
    range: Range,
    goto: AnyTransition,
    stack: StackFrame
  ) {
    this.nonEmpty = true;
    this.map
      .computeIfAbsent(
        follow,
        () =>
          new MapRangeToSpecialSet(
            range => new DecisionNode(this, follow, range)
          )
      )
      .addRange(
        range.from,
        range.to,
        new DecisionNode(this, follow, range).add({ goto, stack })
      );
  }

  *iterate(): Iterable<DecisionNodeNoAdd> {
    for (const [follow, map] of this.map) {
      for (const [range, decision] of map) {
        yield decision;
      }
    }
  }

  [Symbol.iterator]() {
    return this.map[Symbol.iterator]();
  }

  private worthItCache: boolean | null = null;

  private _worthIt() {
    let gotos = -1;
    for (const decision of this.iterate()) {
      if (gotos === -1) {
        gotos = decision.gotosNumber();
      } else if (gotos !== decision.gotosNumber()) {
        return true;
      }
      if (decision.getNextTree()?.worthIt()) {
        return true;
      }
    }
    return false;
  }

  worthIt() {
    return this.worthItCache ?? (this.worthItCache = this._worthIt());
  }
}

export type { DecisionTree, DecisionNodeNoAdd };

class InvertedDecisionTree {
  private readonly map: MapKeyToValue<AnyTransition, DecisionExpr>;
  compatibleWithSwitch: boolean;
  maxLL: number;
  ambiguities: Readonly<{
    decision: DecisionNodeNoAdd;
    condition: DecisionExpr;
  }>[];

  constructor() {
    this.map = new MapKeyToValue();
    this.compatibleWithSwitch = true;
    this.maxLL = 0;
    this.ambiguities = [];
  }

  get(goto: AnyTransition): DecisionExpr {
    return this.map.get(goto) ?? FALSE;
  }

  add(decision: DecisionNodeNoAdd) {
    const condition = this.decisionToTest(decision);
    // assertion(decision.parent.ll === condition.length);

    for (const { goto } of decision) {
      this.map.update(goto, old => (old ? old.or(condition) : condition));
    }

    this.compatibleWithSwitch &&=
      condition instanceof DecisionTestRange &&
      condition.range.from === condition.range.to;
    this.maxLL = Math.max(this.maxLL, decision.parent.ll);

    if (decision.isAmbiguous()) {
      this.ambiguities.push({ decision, condition });
    }
  }

  private decisionToTest(decision: DecisionNodeNoAdd): DecisionExpr {
    const parent = decision.parent.owner;
    const parentCondition = parent ? this.decisionToTest(parent) : TRUE;
    return parentCondition.and(decision.toExpr());
  }
}

type RuleName = string;

export class FollowStack implements ObjectHashEquals {
  readonly info: FollowInfo;
  readonly child: FollowStack | null;
  readonly llPhase: number;
  private cachedHashCode: number;

  constructor(analyzer: Analyzer, child: FollowStack | null, info: FollowInfo) {
    this.info = info;
    this.child = child;
    this.llPhase = analyzer.getLLState();
    this.cachedHashCode = 0;
  }

  hashCode(): number {
    if (this.cachedHashCode === 0) {
      this.cachedHashCode =
        this.info.id *
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

class StackFrame implements ObjectHashEquals {
  readonly parent: StackFrame | null;
  readonly thisRule: RuleName;
  readonly state: DState;
  readonly follow: FollowStack | null;
  readonly llPhase: number;
  private cachedHashCode: number;

  constructor(
    analyzer: Analyzer,
    parent: StackFrame | null,
    thisRule: RuleName,
    state: DState,
    follow: FollowStack | null
  ) {
    this.parent = parent;
    this.thisRule = thisRule;
    this.state = state;
    this.follow = follow;
    this.llPhase = analyzer.getLLState();
    this.cachedHashCode = 0;
  }

  move(analyzer: Analyzer, dest: DState) {
    return new StackFrame(
      analyzer,
      this.parent,
      this.thisRule,
      dest,
      this.follow
    );
  }

  private hasLeftRecursion(call: string) {
    let s: StackFrame | null = this.parent; // Start with parent!
    while (s) {
      if (s.thisRule === call && s.llPhase === this.llPhase) {
        // Avoid infinite loop due to left-recursive grammars.
        // It is enough to check the name and the ll phase to find left-recursion,
        // since if the recursion was guarded with a token, we would not get here.
        // By checking the phase and starting with the parent,
        // we always allow at least one push when we start a new phase.
        return true;
      }
      s = s.parent;
    }
    return false;
  }

  private hasSameFollow(info: FollowInfo) {
    let s: FollowStack | null = this.follow;
    while (s) {
      if (s.info.id === info.id && s.llPhase === this.llPhase) {
        return true;
      }
      s = s.child;
    }
    return false;
  }

  push(analyzer: Analyzer, call: CallTransition): StackFrame {
    if (this.hasLeftRecursion(call.ruleName)) {
      // If we see left recursion in this ll phase,
      // It means the rule is empty
      // For soundness, we need to jump over it to gather lookahead information
      // "this" is the stack we return to after the call
      return this;
    }
    return new StackFrame(
      analyzer,
      this,
      call.ruleName,
      analyzer.initialStates.get(call.ruleName)!!,
      this.follow
    );
  }

  pop(analyzer: Analyzer, ret: ReturnTransition): readonly StackFrame[] {
    if (this.parent) {
      return [this.parent];
    }
    const f = analyzer.follows.get(this.thisRule);
    return f
      ? f
          .filter(info => !this.hasSameFollow(info))
          .map(
            info =>
              new StackFrame(
                analyzer,
                null,
                info.rule,
                info.exitState,
                new FollowStack(analyzer, this.follow, info)
              )
          )
      : [];
  }

  hashCode(): number {
    if (this.cachedHashCode === 0) {
      this.cachedHashCode =
        this.thisRule.length *
        this.state.id *
        (this.parent ? this.parent.hashCode() : 1) *
        (this.follow ? this.follow.hashCode() : 1) *
        (this.llPhase + 1);
    }
    return this.cachedHashCode;
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    if (other instanceof StackFrame) {
      return (
        this.thisRule === other.thisRule &&
        this.state === other.state &&
        this.llPhase === other.llPhase &&
        equals(this.parent, other.parent) &&
        equals(this.follow, other.follow)
      );
    }
    return false;
  }

  toString() {
    return `Stack {rule=${this.thisRule}, state=${this.state.id}}`;
  }
}

export class Analyzer {
  readonly grammar: Grammar;
  readonly initialStates: Map<RuleName, DState>;
  readonly follows: FollowInfoDB;
  // This value is used to distinguish StackFrame's and FollowStack's
  // generated in different phases of the analysis process.
  // We use this because we do not want to avoid pushing/poping
  // the stacks just because some rule was previously seen in a different phase.
  private llState: number;

  constructor({
    grammar,
    initialStates,
    follows,
  }: {
    grammar: Grammar;
    initialStates: Map<RuleName, DState>;
    follows: FollowInfoDB;
  }) {
    this.grammar = grammar;
    this.initialStates = initialStates;
    this.follows = follows;
    this.llState = 0;
  }

  getLLState() {
    return this.llState;
  }

  private ll1(
    start: Iterable<StackFrame>,
    goto: AnyTransition,
    map: DecisionTree
  ) {
    const seen = new MapKeyToValue<StackFrame, boolean>();
    let prev: readonly StackFrame[] = Array.from(start);
    let next: StackFrame[] = [];

    while (prev.length) {
      for (const stack of prev) {
        if (seen.set(stack, true) === true) continue;

        for (const [transition, dest] of stack.state) {
          if (transition instanceof CallTransition) {
            next.push(stack.move(this, dest).push(this, transition));
          } else if (transition instanceof ReturnTransition) {
            next.push(...stack.pop(this, transition));
          } else if (transition instanceof RangeTransition) {
            map.addDecision(
              stack.follow,
              transition,
              goto,
              stack.move(this, dest)
            );
          } else {
            next.push(stack.move(this, dest));
          }
        }
      }
      prev = next;
      next = [];
    }
  }

  // TODO what about the follow of $lexer?

  analyze(rule: Declaration, state: DState, maxLL = 3) {
    // Reset phase
    this.llState = 0;

    const stack = new StackFrame(this, null, rule.name, state, null);
    const ll1 = new DecisionTree(null);
    const inverted = new InvertedDecisionTree();

    this.llState = 1;

    for (const [goto, dest] of state) {
      if (goto instanceof CallTransition) {
        this.ll1([stack.move(this, dest).push(this, goto)], goto, ll1);
      } else if (goto instanceof ReturnTransition) {
        this.ll1(stack.pop(this, goto), goto, ll1);
      } else if (goto instanceof RangeTransition) {
        ll1.addDecision(stack.follow, goto, goto, stack.move(this, dest));
      } else {
        this.ll1([stack.move(this, dest)], goto, ll1);
      }
    }

    let prev: DecisionTreeNoAdd[] = [ll1];
    let next: DecisionTreeNoAdd[] = [];

    this.llState = 2;

    while (prev.length) {
      for (const tree of prev) {
        if (tree.hasDecisions()) {
          for (const decision of tree.iterate()) {
            if (this.llState <= maxLL && decision.isAmbiguous()) {
              const nextTree = decision.ensureNextTree();
              for (const [goto, stack] of decision.iterate()) {
                this.ll1(stack, goto, nextTree);
              }
              next.push(nextTree);
            } else {
              inverted.add(decision);
            }
          }
        } else {
          // If we reached the "end" of the grammar, we do not want to lose the last decision tree
          if (tree.owner) {
            inverted.add(tree.owner);
          }
        }
      }
      prev = next;
      next = [];
      this.llState++;
    }

    // TODO stop on impossible to resolve ambiguities
    // TODO what if I dont need the follow stack to disambiguate?
    // TODO there is also ambiguity when the follow stacks are a subset of one another right?

    this.printAmbiguities(rule, state, maxLL, inverted);

    return {
      tree: ll1,
      inverted,
    };
  }

  printAmbiguities(
    rule: Declaration,
    state: DState,
    maxLL: number,
    inverted: InvertedDecisionTree
  ) {
    const { ambiguities } = inverted;
    if (ambiguities.length === 0) {
      return;
    }
    const gen = new ParserGenerator(this.grammar, this, rule);
    console.log("-----------");
    console.log(
      `Ambiguities in rule ${rule.name}, state ${state.id}, ll = ${maxLL}`
    );
    for (const { decision, condition } of ambiguities) {
      console.log(
        `Condition ${gen.renderDecision(
          condition,
          true
        )} is not enough to choose between:`
      );
      for (const goto of decision.getGotos()) {
        console.log(
          ` - ${gen.renderExpectBlock("", {
            type: "expect_block",
            transition: goto,
          })}`
        );
      }
    }
    console.log("-----------");
  }
}
