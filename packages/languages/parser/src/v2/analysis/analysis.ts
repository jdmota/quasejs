import { DState } from "../automaton/state.ts";
import {
  AnyTransition,
  CallTransition,
  RangeTransition,
  ReturnTransition,
} from "../automaton/transitions.ts";
import { MapKeyToValue } from "../utils/map-key-to-value.ts";
import { MapKeyToSet } from "../utils/map-key-to-set.ts";
import {
  assertion,
  equals,
  nonNull,
  ObjectHashEquals,
} from "../utils/index.ts";
import { MapRangeToSpecialSet, SpecialSet } from "../utils/map-range-to-set.ts";
import { Range } from "../utils/range-utils.ts";
import { ParserGenerator } from "../generators/generate-parser.ts";
import { AugmentedDeclaration, Grammar } from "../grammar/grammar.ts";
import { FollowInfo, FollowInfoDB } from "../grammar/follow-info.ts";
import { MapSet } from "../utils/map-set.ts";

type GotoDecision = Readonly<{
  stack: StackFrame;
  gotos: Iterable<AnyTransition>;
}>;

type DecisionNodeNoAdd = Omit<DecisionNode, "add">;

class DecisionNode implements SpecialSet<GotoDecision> {
  readonly parent: DecisionTree;
  private readonly gotos: MapKeyToSet<AnyTransition, StackFrame>;
  private readonly gotos2: MapKeyToSet<StackFrame, AnyTransition>;
  private nextTree: DecisionTree | null;
  //
  readonly range: DecisionTestRange;
  readonly follow: DecisionTestFollow | null;

  constructor(
    parent: DecisionTree,
    follow: DecisionTestFollow | null,
    range: DecisionTestRange
  ) {
    this.parent = parent;
    this.gotos = new MapKeyToSet();
    this.gotos2 = new MapKeyToSet();
    this.nextTree = null;
    this.range = range;
    assertion(range.ll === parent.ll);
    this.follow = follow;
  }

  getGotos(): readonly AnyTransition[] {
    return Array.from(this.gotos).map(e => e[0]);
  }

  hasGoto(t: AnyTransition) {
    return this.gotos.get(t).size > 0;
  }

  add({ stack, gotos }: GotoDecision) {
    assertion(this.nextTree === null);
    for (const goto of gotos) {
      this.gotos.addOne(goto, stack);
    }
    this.gotos2.add(stack, gotos);
    return this;
  }

  gotosNumber() {
    return this.gotos.size;
  }

  isAmbiguous() {
    return this.gotos.size > 1;
  }

  *[Symbol.iterator]() {
    for (const [stack, gotos] of this.gotos2) {
      yield { stack, gotos };
    }
  }

  getNextTree() {
    return this.nextTree;
  }

  ensureNextTree() {
    return this.nextTree ?? (this.nextTree = new DecisionTree(this));
  }

  toExpr() {
    return DecisionAnd.create([this.range, this.follow ?? TRUE]);
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
    if (other instanceof DecisionTestRange) {
      return (
        this.ll === other.ll && this.from === other.from && this.to === other.to
      );
    }
    return false;
  }
}

type FlatFollowStack = readonly FollowInfo[];

function flatFollowStack(follow: FollowStack): FlatFollowStack {
  let f: FollowStack | null = follow;
  const array = [];
  do {
    array.push(f.info);
    f = f.child;
  } while (f);
  return array;
}

export class DecisionTestFollow
  extends AbstractDecision
  implements ObjectHashEquals
{
  readonly follow: readonly FollowInfo[];

  constructor(follow: FollowStack) {
    super();
    this.follow = flatFollowStack(follow);
  }

  hashCode(): number {
    return this.follow.length;
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    if (other instanceof DecisionTestFollow) {
      return (
        this.follow.length === other.follow.length &&
        this.follow.every((val, idx) => val.id === other.follow[idx].id)
      );
    }
    return false;
  }
}

type DecisionTreeNoAdd = Omit<DecisionTree, "addDecision">;

class DecisionTree {
  private readonly map: MapKeyToValue<
    DecisionTestFollow | null,
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
    gotos: Iterable<AnyTransition>,
    stack: StackFrame
  ) {
    const dFollow = follow ? new DecisionTestFollow(follow) : null;

    this.nonEmpty = true;
    this.map
      .computeIfAbsent(
        dFollow,
        () =>
          new MapRangeToSpecialSet(
            (from, to) =>
              new DecisionNode(
                this,
                dFollow,
                new DecisionTestRange(this.ll, from, to)
              )
          )
      )
      .addRange(range.from, range.to, [
        {
          gotos,
          stack,
        },
      ]);
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

    for (const { gotos } of decision) {
      for (const goto of gotos) {
        this.map.update(goto, old => (old ? old.or(condition) : condition));
      }
    }

    this.compatibleWithSwitch &&=
      condition instanceof DecisionTestRange && condition.from === condition.to;
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
        (this.info.id + 1) *
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

  // Was this rule entered at least once in this phase?
  wasPushed(call: string) {
    let s: StackFrame | null = this;
    while (s && s.llPhase === this.llPhase) {
      // If 's' is in a different phase, all parents are also in different phases
      if (s.thisRule === call) {
        // If the parent is in the same phase,
        // it means this stack is not the root and we can return true
        // Otherwise, this is the root and we should return false
        // to allow for the actual first push of this rule in this phase
        return s.parent ? s.parent.llPhase === s.llPhase : false;
      }
      s = s.parent;
    }
    return false;
  }

  private hasSameFollow(info: FollowInfo) {
    let s: FollowStack | null = this.follow;
    while (s && s.llPhase === this.llPhase) {
      // If 's' is in a different phase, all childs are also in different phases
      if (s.info.id === info.id) {
        return true;
      }
      s = s.child;
    }
    return false;
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

  // Since we move() before push(),
  // there is always a parent frame in the current phase
  // which serves as the root of the phase

  push(analyzer: Analyzer, call: CallTransition) {
    // To interrupt recursion, we need to guarantee that
    // other branches being explored will gather the lookahead that
    // would be obtained by entering this rule again.
    // If we see this rule in the stack (except if it is the root of a new phase or a frame from different phase),
    // we can be sure that we do not need to enter this rule again (because it was entered before in this same phase).
    if (this.wasPushed(call.ruleName)) {
      // If we see left recursion in this ll phase,
      // and if the rule may be empty,
      // we need to jump over it to gather lookahead information.
      // The other branches in this phase are responsible
      // for gathering the rest of the lookahead information.
      return null;
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

  private readonly emptyRules = new Set<RuleName>();

  private ll1(
    start: readonly StackFrame[],
    gotos: Iterable<AnyTransition>,
    map: DecisionTree
  ) {
    const empty = this.emptyRules;
    const delayedReturns = new MapSet<RuleName, StackFrame>();
    //
    const seen = new MapKeyToValue<StackFrame, boolean>();
    let prev: readonly StackFrame[] = start;
    let next: StackFrame[] = [];

    while (prev.length) {
      for (const stack of prev) {
        if (seen.set(stack, true) === true) continue;

        for (const [edge, dest] of stack.state) {
          if (edge instanceof CallTransition) {
            const ret = stack.move(this, dest);
            const pushed = ret.push(this, edge);
            if (pushed) {
              next.push(pushed);
            } else if (empty.has(edge.ruleName)) {
              next.push(ret);
            } else {
              delayedReturns.add(edge.ruleName, ret);
            }
          } else if (edge instanceof ReturnTransition) {
            next.push(...stack.pop(this, edge));
            // Deal with possibly empty rules
            if (!empty.has(edge.ruleName) && stack.wasPushed(edge.ruleName)) {
              empty.add(edge.ruleName);
              next.push(...delayedReturns.get(edge.ruleName));
              delayedReturns.clearMany(edge.ruleName);
            }
          } else if (edge instanceof RangeTransition) {
            map.addDecision(stack.follow, edge, gotos, stack.move(this, dest));
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
  // TODO what about left recursive rules?

  /*
  E[1] -> E[2] ( + E[2] | - E[2] )* // left assoc
  E[2] -> E[3] ( ** E[2] )? // right assoc
  E[3] -> - E[3] | E[4]
  E[4] -> num | ( E[1] )

  E -> E + E
       E - E
       E ** E
       - E
       ( E )
       num

  E -> E prec(+,1) E
       E prec(-,1) E
       E prec(**,2,right) E
       prec(-,3) E
       ( E )
       num

  // https://tree-sitter.github.io/tree-sitter/creating-parsers#using-precedence

  E -> prec.left(1, E + E)
       prec.left(1, E - E)
       prec.right(2, E ** E)
       prec(3, - E)
       ( E )
       num

  // If precedences are equal, then associativity is used
  */

  analyze(rule: AugmentedDeclaration, state: DState, maxLL = 3) {
    // Reset phase
    this.llState = 0;

    const stack = new StackFrame(this, null, rule.name, state, null);
    const ll1 = new DecisionTree(null);
    const inverted = new InvertedDecisionTree();

    this.llState = 1;

    for (const [goto, dest] of state) {
      if (goto instanceof CallTransition) {
        // The stack will be turned from
        // | rule.name , state, ll=0 |
        // |           null          |
        // to
        // | calledRule, ...  , ll=1 |
        // | rule.name , dest , ll=1 | (root of the new phase resulting from move)
        // |           null          |
        //
        // If rule.name == calledRule, the push is allowed because we need to enter the rule at least once
        // (to this end we ignore the root).
        // If inside calledRule, we push calledRule again, we interrupt
        // (because we already crossed the rule's entry once for sure).
        // See StackFrame#wasPushed() and StackFrame#push().
        this.ll1(
          [nonNull(stack.move(this, dest).push(this, goto))],
          [goto],
          ll1
        );
      } else if (goto instanceof ReturnTransition) {
        this.ll1(stack.pop(this, goto), [goto], ll1);
      } else if (goto instanceof RangeTransition) {
        ll1.addDecision(stack.follow, goto, [goto], stack.move(this, dest));
      } else {
        this.ll1([stack.move(this, dest)], [goto], ll1);
      }
    }

    let prev: readonly DecisionTreeNoAdd[] = [ll1];
    let next: DecisionTreeNoAdd[] = [];

    this.llState = 2;

    while (prev.length) {
      for (const tree of prev) {
        if (tree.hasDecisions()) {
          for (const decision of tree.iterate()) {
            if (this.llState <= maxLL && decision.isAmbiguous()) {
              const nextTree = decision.ensureNextTree();
              for (const { stack, gotos } of decision) {
                this.ll1([stack], gotos, nextTree);
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

    // TODO what if I dont need the follow stack to disambiguate?
    // TODO there is also ambiguity when the follow stacks are a subset of one another right?

    this.printAmbiguities(rule, state, maxLL, inverted);

    return {
      tree: ll1,
      inverted,
    };
  }

  printAmbiguities(
    rule: AugmentedDeclaration,
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
