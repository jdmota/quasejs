import { DState } from "../automaton/state.ts";
import {
  AnyTransition,
  CallTransition,
  RangeTransition,
  ReturnTransition,
} from "../automaton/transitions.ts";
import { MapKeyToValue } from "../utils/map-key-to-value.ts";
import { SpecialSet, MapKeyToSet } from "../utils/map-key-to-set.ts";
import {
  assertion,
  equals,
  nonNull,
  ObjectHashEquals,
  unreachable,
} from "../utils/index.ts";
import { MapRangeToSpecialSet } from "../utils/map-range-to-set.ts";
import { Range } from "../utils/range-utils.ts";
import { ParserGenerator } from "../generators/generate-parser.ts";
import { AugmentedDeclaration, Grammar } from "../grammar/grammar.ts";
import { FollowInfo, FollowInfoDB } from "../grammar/follow-info.ts";
import { MapSet } from "../utils/map-set.ts";
import {
  DecisionExpr,
  DecisionTestFollow,
  DecisionTestToken,
  FALSE,
  TRUE,
  getInFollowStack,
} from "./decision-expr.ts";

const DEBUG = {
  worthIt: false,
};

export function DEBUG_apply(rule: AugmentedDeclaration) {
  if (rule.modifiers._debug?.worthIt) {
    DEBUG.worthIt = true;
  }
}

export function DEBUG_unapply() {
  DEBUG.worthIt = false;
}

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
  readonly decision: DecisionExpr;

  constructor(parent: DecisionTree, decision: DecisionExpr) {
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

  ensureNextTokenTree() {
    assertion(!this.nextTree);
    return (this.nextTree = new DecisionTokenTree(this));
  }

  ensureNextFollowTree() {
    assertion(!this.nextTree);
    return (this.nextTree = new DecisionFollowTree(this));
  }

  toExpr() {
    return this.decision;
  }

  toString() {
    return `(decision ${this.toExpr().toString()} (${this.getGotos()
      .map(t => t.toString())
      .join(" ")}))`;
  }
}

abstract class AbstractDecisionTree {
  private readonly map: MapRangeToSpecialSet<GotoDecision, DecisionNode>;
  private nonEmpty: boolean;
  readonly owner: DecisionNode | null;

  constructor(
    owner: DecisionNode | null,
    fn: (from: number, to: number) => DecisionNode
  ) {
    this.owner = owner;
    this.nonEmpty = false;
    this.map = new MapRangeToSpecialSet(fn);
  }

  hasDecisions() {
    return this.nonEmpty;
  }

  protected addRange(
    from: number,
    to: number,
    gotos: Iterable<AnyTransition>,
    stack: StackFrame
  ) {
    this.nonEmpty = true;
    this.map.addRange(from, to, [
      {
        gotos,
        stack,
      },
    ]);
  }

  *iterate(): Iterable<DecisionNodeNoAdd> {
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

export class DecisionTokenTree extends AbstractDecisionTree {
  readonly ll: number;

  constructor(owner: DecisionNode | null) {
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

  addDecision(range: Range, gotos: Iterable<AnyTransition>, stack: StackFrame) {
    this.addRange(range.from, range.to, gotos, stack);
  }
}

export class DecisionFollowTree extends AbstractDecisionTree {
  readonly ff: number;

  constructor(owner: DecisionNode) {
    super(
      owner,
      (from, to) =>
        new DecisionNode(this, new DecisionTestFollow(this.ff, from, to))
    );
    this.ff =
      owner?.parent instanceof DecisionFollowTree ? owner.parent.ff + 1 : 1;
  }

  addDecision(
    rule: RuleName,
    followDB: FollowInfoDB,
    follow: FollowInfo | null,
    gotos: Iterable<AnyTransition>,
    stack: StackFrame
  ) {
    if (follow) {
      this.addRange(follow.id, follow.id, gotos, stack);
    } else {
      const ids = followDB.getIdRangeByIndex(rule, this.ff);
      for (const id of ids) {
        this.addRange(id, id, gotos, stack);
      }
    }
  }
}

export type DecisionTree = DecisionTokenTree | DecisionFollowTree;

export type DecisionTreeNoAdd = Omit<DecisionTree, "addDecision">;

export type { DecisionNodeNoAdd, FollowStack };

class InvertedDecisionTree {
  private readonly map: MapKeyToValue<AnyTransition, DecisionExpr>;
  compatibleWithSwitch: boolean;
  ambiguities: Readonly<{
    decision: DecisionNodeNoAdd;
    condition: DecisionExpr;
  }>[];

  constructor() {
    this.map = new MapKeyToValue();
    this.compatibleWithSwitch = true;
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
      condition instanceof DecisionTestToken && condition.from === condition.to;
    // this.maxLL = Math.max(this.maxLL, decision.parent.ll);

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

class FollowStack implements ObjectHashEquals {
  readonly info: FollowInfo;
  readonly child: FollowStack | null;
  readonly llPhase: number;
  readonly size: number;
  private cachedHashCode: number;

  constructor(analyzer: Analyzer, child: FollowStack | null, info: FollowInfo) {
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

class StackFrame implements ObjectHashEquals {
  readonly parent: StackFrame | null;
  readonly thisRule: RuleName;
  readonly state: DState;
  readonly follow: FollowStack | null;
  readonly llPhase: number;
  private readonly size: number;
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
    this.size = parent ? parent.size + 1 : 1;
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
          .filter(info => !this.hasSameFollow(info)) // TODO it seems if we ignore the phase and just try to find the same follow info, we finish faster...
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
        this.size *
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
        this.size === other.size &&
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
  readonly follows: FollowInfoDB;
  readonly initialStates: Map<RuleName, DState>;
  // This value is used to distinguish StackFrame's and FollowStack's
  // generated in different phases of the analysis process.
  // We use this because we do not want to avoid pushing/poping
  // the stacks just because some rule was previously seen in a different phase.
  private llState: number;

  constructor({
    grammar,
    initialStates,
  }: {
    grammar: Grammar;
    initialStates: Map<RuleName, DState>;
  }) {
    this.grammar = grammar;
    this.follows = grammar.follows;
    this.initialStates = initialStates;
    this.llState = 0;
  }

  getLLState() {
    return this.llState;
  }

  private readonly emptyRules = new Set<RuleName>();

  private ll1(
    start: readonly StackFrame[],
    gotos: Iterable<AnyTransition>,
    map: DecisionTokenTree
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
            map.addDecision(edge, gotos, stack.move(this, dest));
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

  private readonly cache = new WeakMap<
    DState,
    {
      tree: DecisionTokenTree;
      inverted: InvertedDecisionTree;
    }
  >();

  analyze(rule: AugmentedDeclaration, state: DState, maxLL = 3, maxFF = 3) {
    const inCache = this.cache.get(state);
    if (inCache) return inCache;

    // Reset phase
    this.llState = 0;

    const stack = new StackFrame(this, null, rule.name, state, null);
    const ll1 = new DecisionTokenTree(null);
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
        // (because we already crossed the rule's entry once in this phase for sure).
        // See StackFrame#wasPushed() and StackFrame#push().
        this.ll1(
          [nonNull(stack.move(this, dest).push(this, goto))],
          [goto],
          ll1
        );
      } else if (goto instanceof ReturnTransition) {
        this.ll1(stack.pop(this, goto), [goto], ll1);
      } else if (goto instanceof RangeTransition) {
        ll1.addDecision(goto, [goto], stack.move(this, dest));
      } else {
        this.ll1([stack.move(this, dest)], [goto], ll1);
      }
    }

    let prev: readonly DecisionTreeNoAdd[] = [ll1];
    let next: DecisionTreeNoAdd[] = [];

    this.llState = 2;

    let followIndex = 1;

    while (prev.length) {
      const inLLAnalysis = this.llState <= maxLL;
      const inFFAnalysis = followIndex <= maxFF;

      for (const tree of prev) {
        if (tree.hasDecisions()) {
          for (const decision of tree.iterate()) {
            if (decision.isAmbiguous()) {
              if (inLLAnalysis) {
                const nextTree = decision.ensureNextTokenTree();
                assertion(nextTree.ll === this.llState);
                for (const { stack, gotos } of decision) {
                  this.ll1([stack], gotos, nextTree);
                }
                next.push(nextTree);
              } else if (inFFAnalysis) {
                let hasUsefulFollows = false;
                const nextTree = decision.ensureNextFollowTree();
                assertion(nextTree.ff === followIndex);
                for (const { stack, gotos } of decision) {
                  if (stack.follow && followIndex <= stack.follow.size) {
                    nextTree.addDecision(
                      rule.name,
                      this.follows,
                      getInFollowStack(stack.follow, followIndex),
                      gotos,
                      stack
                    );
                    hasUsefulFollows = true;
                  } else {
                    nextTree.addDecision(
                      rule.name,
                      this.follows,
                      null,
                      gotos,
                      stack
                    );
                  }
                }
                if (hasUsefulFollows) {
                  next.push(nextTree);
                } else {
                  inverted.add(decision);
                }
                // TODO (1) then optimize: what is the minimum things we need to check to make a decision? shortest-path algorithm?
                // TODO (addressed by 1) there is also ambiguity when the follow stacks are a subset of one another right?
                // TODO (addressed by 1) what if I dont need the follow stack to disambiguate?
              } else {
                inverted.add(decision);
              }
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
      if (inLLAnalysis) {
        this.llState++;
      } else if (inFFAnalysis) {
        followIndex++;
      }
    }

    this.printAmbiguities(rule, state, maxLL, inverted);

    const result = {
      tree: ll1,
      inverted,
    };
    this.cache.set(state, result);
    return result;
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
