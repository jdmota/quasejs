import { DState } from "../automaton/state.ts";
import {
  type AnyTransition,
  CallTransition,
  RangeTransition,
  ReturnTransition,
} from "../automaton/transitions.ts";
import { MapKeyToValue } from "../../util/data-structures/map-key-to-value.ts";
import {
  assertion,
  equals,
  nonNull,
  type ObjectHashEquals,
} from "../../util/miscellaneous.ts";
import { MapSet } from "../../util/data-structures/map-set.ts";
import { type Range } from "../../util/range-utils.ts";
import { CodeGenerator } from "../generators/generate-code.ts";
import { type AugmentedDeclaration, Grammar } from "../grammar/grammar.ts";
import { type FollowInfo, FollowInfoDB } from "../grammar/follow-info.ts";
import { getInFollowStack } from "./decision-expr.ts";
import { DEBUG, DEBUG_apply, DEBUG_unapply } from "./analysis-debug.ts";
import { FollowStack } from "./follow-stack.ts";
import {
  DecisionTokenTree,
  InvertedDecisionTree,
  type DecisionTreeNoAdd,
} from "./decision-trees.ts";
import { ANY_CHAR_RANGE } from "../utils/constants.ts";
import { LEXER_RULE_NAME } from "../grammar/tokens.ts";
import type { RuleName } from "../grammar/grammar-builder.ts";
import { LabelsManager } from "../generators/labels-manager.ts";

// IMPORTANT!
// This reference implementation does not find all the possible "follow" sequences
// when dealing with left recursive rules
// The GLL version however, with it's GSS stack structure, can encode all possible pushes and pops
// which then allows us to reconstruct the "follow" sequences
// So, for left recursive rules, the "follows" produced herein are not trustworthy
// Nonetheless, we can use this reference implementation to double-check non-left recursive rules

class StackFrame implements ObjectHashEquals {
  readonly parent: StackFrame | null;
  readonly thisRule: RuleName;
  readonly state: DState;
  readonly follow: FollowStack | null;
  readonly llPhase: number;
  private readonly size: number;
  private cachedHashCode: number;

  constructor(
    analyzer: IAnalyzer<StackFrame>,
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
      if (s.followID === info.id) {
        return true;
      }
      s = s.child;
    }
    return false;
  }

  move(analyzer: IAnalyzer<StackFrame>, dest: DState) {
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

  push(analyzer: IAnalyzer<StackFrame>, call: CallTransition) {
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

  pop(
    analyzer: IAnalyzer<StackFrame>,
    ret: ReturnTransition,
    maxFF: number
  ): null | readonly StackFrame[] {
    if (this.parent) {
      return [this.parent];
    }
    const maxed = (this.follow?.size ?? 0) >= maxFF;
    const f = analyzer.follows.get(this.thisRule);
    if (f.length === 0) {
      return null;
    }
    return f
      .filter(info => !(maxed && this.hasSameFollow(info)))
      .map(
        info =>
          new StackFrame(
            analyzer,
            null,
            info.rule,
            info.exitState,
            new FollowStack(analyzer, this.follow, info.id)
          )
      );
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

export type AnalysisResult<P extends ObjectHashEquals> = {
  readonly tree: DecisionTokenTree<P>;
  readonly inverted: InvertedDecisionTree<P>;
};

export abstract class IAnalyzer<P extends ObjectHashEquals> {
  readonly grammar: Grammar;
  readonly follows: FollowInfoDB;
  readonly initialStates: ReadonlyMap<RuleName, DState>;

  constructor({
    grammar,
    initialStates,
  }: {
    grammar: Grammar;
    initialStates: ReadonlyMap<RuleName, DState>;
  }) {
    this.grammar = grammar;
    this.follows = grammar.follows;
    this.initialStates = initialStates;
    grammar._debugAnalysis.push(`--------------------`);
  }

  abstract getLLState(): number;
  abstract getAnyRange(): Range;
  abstract analyze(
    rule: AugmentedDeclaration,
    state: DState
  ): AnalysisResult<P>;

  printAmbiguities(
    rule: AugmentedDeclaration,
    state: DState,
    maxLL: number,
    inverted: InvertedDecisionTree<P>
  ) {
    inverted._debugPrint(this.grammar, rule, state);
    if (!inverted.hasAmbiguities()) {
      return;
    }
    const { ambiguities, leftRecursions } = inverted;
    const gen = new CodeGenerator(
      this.grammar,
      this,
      rule,
      new LabelsManager(new Set()),
      new Map()
    );
    console.log("-----------");
    console.log(
      `Ambiguities in rule ${rule.name}, state ${state.id}, ll = ${maxLL}`
    );
    for (const { decisions, condition } of ambiguities) {
      console.log(
        `Condition ${gen.renderDecision(
          condition,
          true
        )} is not enough to choose between:`
      );
      for (const goto of decisions) {
        console.log(` - ${goto.toString()}`);
      }
    }
    for (const { decisions, condition } of leftRecursions) {
      console.log(
        `Condition ${gen.renderDecision(
          condition,
          true
        )} may lead to left recursions via these decisions:`
      );
      for (const goto of decisions) {
        console.log(` - ${goto.toString()}`);
      }
    }
    console.log("-----------");
  }
}

export class AnalyzerReference extends IAnalyzer<StackFrame> {
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
    initialStates: ReadonlyMap<RuleName, DState>;
  }) {
    super({
      grammar,
      initialStates,
    });
    this.llState = 0;
  }

  getLLState() {
    return this.llState;
  }

  private readonly emptyRules = new Set<RuleName>();

  private ll1(
    start: readonly StackFrame[],
    gotos: readonly AnyTransition[] | ReadonlySet<AnyTransition>,
    map: DecisionTokenTree<StackFrame>,
    maxFF: number
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
            } else {
              map.addAny(gotos);
              if (empty.has(edge.ruleName)) {
                next.push(ret);
              } else {
                delayedReturns.add(edge.ruleName, ret);
              }
            }
          } else if (edge instanceof ReturnTransition) {
            const popped = stack.pop(this, edge, maxFF);
            if (popped) {
              next.push(...popped);
            } else {
              map.addEof(gotos, stack);
            }
            // Deal with empty rules
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

  private readonly cache = new WeakMap<
    DState,
    {
      readonly tree: DecisionTokenTree<StackFrame>;
      readonly inverted: InvertedDecisionTree<StackFrame>;
    }
  >();

  public currentRule: AugmentedDeclaration = null as any;

  getAnyRange() {
    return this.currentRule.type === "rule"
      ? this.grammar.tokens.anyRange()
      : ANY_CHAR_RANGE;
  }

  analyze(rule: AugmentedDeclaration, state: DState) {
    const inCache = this.cache.get(state);
    if (inCache) return inCache;

    let maxLL, maxFF;
    if (rule.name === LEXER_RULE_NAME) {
      maxLL = 1;
      maxFF = 0;
    } else {
      maxLL = this.grammar.maxLL;
      maxFF = this.grammar.maxFF;
    }

    DEBUG_apply(rule);
    this.currentRule = rule;

    // Reset phase
    this.llState = 0;

    const stack = new StackFrame(this, null, rule.name, state, null);
    const ll1 = new DecisionTokenTree<StackFrame>(null);
    const inverted = new InvertedDecisionTree<StackFrame>();

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
          ll1,
          maxFF
        );
      } else if (goto instanceof ReturnTransition) {
        const popped = stack.pop(this, goto, maxFF);
        if (popped) {
          this.ll1(popped, [goto], ll1, maxFF);
        } else {
          ll1.addEof([goto], stack);
        }
      } else if (goto instanceof RangeTransition) {
        ll1.addDecision(goto, [goto], stack.move(this, dest));
      } else {
        this.ll1([stack.move(this, dest)], [goto], ll1, maxFF);
      }
    }

    let prev: readonly DecisionTreeNoAdd<StackFrame>[] = [ll1];
    let next: DecisionTreeNoAdd<StackFrame>[] = [];

    this.llState = 2;

    let followIndex = 1;

    while (prev.length) {
      const inLLAnalysis = this.llState <= maxLL;
      const inFFAnalysis = followIndex <= maxFF;

      for (const tree of prev) {
        if (!tree.hasDecisions() && tree.owner) inverted.add(tree.owner);
        if (tree.hasAnyDecisions()) inverted.addAny(tree);
        for (const decision of tree.iterate()) {
          if (DEBUG.keepGoing || decision.isAmbiguous()) {
            if (inLLAnalysis) {
              const nextTree = decision.ensureNextTokenTree();
              assertion(nextTree.ll === this.llState);
              for (const { desc: stack, gotos } of decision) {
                this.ll1([stack], gotos, nextTree, maxFF);
              }
              next.push(nextTree);
            } else if (inFFAnalysis) {
              const nextTree = decision.ensureNextFollowTree();
              assertion(nextTree.ff === followIndex);
              for (const { desc: stack, gotos } of decision) {
                if (stack.follow) {
                  nextTree.addDecision(
                    rule.name,
                    this.follows,
                    getInFollowStack(stack.follow, followIndex),
                    gotos,
                    stack
                  );
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
              next.push(nextTree);
            } else {
              inverted.add(decision);
            }
          } else {
            inverted.add(decision);
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

    DEBUG_unapply();

    this.printAmbiguities(rule, state, maxLL, inverted);

    const result = {
      tree: ll1,
      inverted,
    };
    this.cache.set(state, result);
    return result;
  }
}
