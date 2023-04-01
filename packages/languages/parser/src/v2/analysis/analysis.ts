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

  add({ goto, stack }: GotoDecision) {
    assertion(this.nextTree === null);
    this.gotos.addOne(goto, stack);
    return this;
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
}

export type DecisionTest = Readonly<{
  follow: FollowStack | null;
  range: Range;
}>;

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
}

export type DecisionAnd = readonly DecisionTest[];
export type DecisionOr = readonly DecisionAnd[];

class InvertedDecisionTree {
  private readonly map: MapKeyToValue<AnyTransition, DecisionAnd[]>;
  compatibleWithSwitch: boolean;
  maxLL: number;
  ambiguities: Readonly<{
    decision: DecisionNodeNoAdd;
    condition: DecisionAnd;
  }>[];

  constructor() {
    this.map = new MapKeyToValue();
    this.compatibleWithSwitch = true;
    this.maxLL = 0;
    this.ambiguities = [];
  }

  get(goto: AnyTransition): DecisionOr {
    return this.map.get(goto) ?? [];
  }

  add(decision: DecisionNodeNoAdd) {
    const condition = this.decisionToTest(decision);
    assertion(decision.parent.ll === condition.length);

    for (const { goto } of decision) {
      this.map.computeIfAbsent(goto, () => []).push(condition);

      if (this.compatibleWithSwitch) {
        if (
          condition.length > 1 ||
          condition[0].follow ||
          condition[0].range.from !== condition[0].range.to
        ) {
          this.compatibleWithSwitch = false;
        }
      }
    }
    this.maxLL = Math.max(this.maxLL, condition.length);

    if (decision.isAmbiguous()) {
      this.ambiguities.push({ decision, condition });
    }
  }

  private decisionToTest(decision: DecisionNodeNoAdd): DecisionTest[] {
    const parent = decision.parent.owner;
    const arr = parent ? this.decisionToTest(parent) : [];
    arr.push({ follow: decision.follow, range: decision.range });
    return arr;
  }
}

type RuleName = string;

class FollowStack implements ObjectHashEquals {
  readonly child: FollowStack | null;
  readonly thisRule: RuleName;
  readonly exitState: DState;
  private cachedHashCode: number;

  constructor(
    child: FollowStack | null,
    thisRule: RuleName,
    exitState: DState
  ) {
    this.child = child;
    this.thisRule = thisRule;
    this.exitState = exitState;
    this.cachedHashCode = 0;
  }

  hashCode(): number {
    if (this.cachedHashCode === 0) {
      this.cachedHashCode =
        this.thisRule.length *
        this.exitState.id *
        (this.child ? this.child.hashCode() : 1);
    }
    return this.cachedHashCode;
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    if (other instanceof FollowStack) {
      return (
        this.thisRule === other.thisRule &&
        this.exitState === other.exitState &&
        equals(this.child, other.child)
      );
    }
    return false;
  }

  toString() {
    const { child } = this;
    return `${this.thisRule}${child ? `,${child}` : ""}`;
  }
}

class StackFrame implements ObjectHashEquals {
  readonly analyzer: Analyzer;
  readonly parent: StackFrame | null;
  readonly thisRule: RuleName;
  readonly state: DState;
  readonly follow: FollowStack | null;
  private cachedHashCode: number;

  constructor(
    analyzer: Analyzer,
    parent: StackFrame | null,
    thisRule: RuleName,
    state: DState,
    follow: FollowStack | null
  ) {
    this.analyzer = analyzer;
    this.parent = parent;
    this.thisRule = thisRule;
    this.state = state;
    this.follow = follow;
    this.cachedHashCode = 0;
  }

  move(dest: DState) {
    return new StackFrame(
      this.analyzer,
      this.parent,
      this.thisRule,
      dest,
      this.follow
    );
  }

  push(call: CallTransition) {
    return new StackFrame(
      this.analyzer,
      this,
      call.ruleName,
      this.analyzer.initialStates.get(call.ruleName)!!,
      this.follow
    );
  }

  pop(ret: ReturnTransition): Readonly<StackFrame[]> {
    if (this.parent) {
      return [this.parent];
    }
    const f = this.analyzer.follows.get(this.thisRule);
    // Rules with an empty follow set are the start rule or unused rules
    // The start rule should terminate with the "end" token, so we never get here
    // Unused rules are not reachable nor analyzed
    // In summary, do not worry about empty follow sets
    // TODO do not analyze unused rules assertion(!!f && f.length > 0);
    return f
      ? f.map(
          info =>
            new StackFrame(
              this.analyzer,
              null,
              info.rule,
              info.exitState,
              new FollowStack(this.follow, info.rule, info.exitState)
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
        (this.follow ? this.follow.hashCode() : 1);
    }
    return this.cachedHashCode;
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    if (other instanceof StackFrame) {
      return (
        this.analyzer === other.analyzer &&
        equals(this.parent, other.parent) &&
        this.thisRule === other.thisRule &&
        this.state === other.state &&
        equals(this.follow, other.follow)
      );
    }
    return false;
  }

  toString() {
    return `Stack {rule=${this.thisRule}, state=${this.state.id}}`;
  }
}

export type AnalyzerFollow = {
  readonly rule: RuleName;
  readonly enterState: DState;
  readonly exitState: DState;
};

type Lookahead = readonly [RangeTransition, StackFrame];

export class Analyzer {
  readonly grammar: Grammar;
  readonly initialStates: Map<RuleName, DState>;
  readonly follows: Map<RuleName, AnalyzerFollow[]>;
  private cache: MapKeyToValue<StackFrame, Lookahead[] | null>;

  constructor({
    grammar,
    initialStates,
    follows,
  }: {
    grammar: Grammar;
    initialStates: Map<RuleName, DState>;
    follows: Map<RuleName, AnalyzerFollow[]>;
  }) {
    this.grammar = grammar;
    this.initialStates = initialStates;
    this.follows = follows;
    this.cache = new MapKeyToValue();
  }

  private ll1(
    start: Iterable<StackFrame>,
    goto: AnyTransition,
    map: DecisionTree
  ) {
    const seen = new MapKeyToValue<StackFrame, boolean>();
    let prev: readonly StackFrame[] = Array.from(start);
    let next: StackFrame[] = [];

    // TODO this will fail if we have left-recursion

    while (prev.length) {
      for (const stack of prev) {
        if (seen.set(stack, true) === true) continue;
        // FIXME instead of this, what we need is a cache from StackFrame to ll1 set

        for (const [transition, dest] of stack.state) {
          if (transition instanceof CallTransition) {
            next.push(stack.move(dest).push(transition));
          } else if (transition instanceof ReturnTransition) {
            next.push(...stack.pop(transition));
          } else if (transition instanceof RangeTransition) {
            map.addDecision(stack.follow, transition, goto, stack.move(dest));
          } else {
            next.push(stack.move(dest));
          }
        }
      }
      prev = next;
      next = [];
    }
  }

  analyze(rule: Declaration, state: DState, maxLL = 3) {
    const stack = new StackFrame(this, null, rule.name, state, null);
    const ll1 = new DecisionTree(null);
    const inverted = new InvertedDecisionTree();

    for (const [goto, dest] of state) {
      if (goto instanceof CallTransition) {
        this.ll1([stack.move(dest).push(goto)], goto, ll1);
      } else if (goto instanceof ReturnTransition) {
        this.ll1(stack.pop(goto), goto, ll1);
      } else if (goto instanceof RangeTransition) {
        ll1.addDecision(stack.follow, goto, goto, stack.move(dest));
      } else {
        this.ll1([stack.move(dest)], goto, ll1);
      }
    }

    let prev = [ll1];
    let next = [];
    let ll = 2;

    while (prev.length) {
      for (const tree of prev) {
        if (tree.hasDecisions()) {
          for (const decision of tree.iterate()) {
            if (ll <= maxLL && decision.isAmbiguous()) {
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
      ll++;
    }

    // TODO stop on impossible to resolve ambiguities
    // TODO what if I dont need the follow stack to desambiguate?

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
        `Condition ${gen.renderConditionAnd(
          condition
        )} is not enough to choose between:`
      );
      for (const goto of decision.getGotos()) {
        console.log(` - ${gen.renderTransition(goto)}`);
      }
    }
    console.log("-----------");
  }
}
