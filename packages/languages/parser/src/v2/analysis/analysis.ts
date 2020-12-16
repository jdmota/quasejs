import { DState } from "../automaton/state";
import {
  AnyTransition,
  RuleTransition,
  RangeTransition,
  ReturnTransition,
} from "../automaton/transitions";
import { MapKeyToValue } from "../utils/map-key-to-value";
import { MapKeyToSet } from "../utils/map-key-to-set";

type RuleName = string;

class DecisionNode {
  // Map the decision to make (i.e. the transition to perform)
  // to points where the analysis stopped when computing the lookahead of this decision
  readonly gotos: MapKeyToSet<AnyTransition, StackFrame>;
  readonly children: DecisionsTree;
  readonly ll: number;

  constructor(ll: number) {
    this.ll = ll;
    this.children = new DecisionsTree(ll + 1);
    this.gotos = new MapKeyToSet<AnyTransition, StackFrame>();
  }

  addGoto(goto: AnyTransition, leftIn: StackFrame) {
    this.gotos.addOne(goto, leftIn);
  }

  isAmbiguous() {
    return this.gotos.size > 1;
  }

  toString(indent = "") {
    let str = `DecisionNode {\n`;
    for (const [key, _] of this.gotos) {
      str += `${indent}  ${key},\n`;
    }
    str += `${this.children.toString(`${indent}  `)},\n`;
    return str + `${indent}}`;
  }
}

class DecisionsTree {
  private map = new MapKeyToValue<RangeTransition, DecisionNode>();
  readonly ll: number;

  constructor(ll: number) {
    this.ll = ll;
  }

  addDecision(what: RangeTransition, goto: AnyTransition, leftIn: StackFrame) {
    const node = this.map.computeIfAbsent(
      what,
      () => new DecisionNode(this.ll)
    );
    node.addGoto(goto, leftIn);
    return node;
  }

  toString(indent = "") {
    let str = `${indent}DecisionTree (ll: ${this.ll}) {\n`;
    for (const [key, value] of this.map) {
      str += `${indent}  ${key}: ${value.toString(`${indent}  `)},\n`;
    }
    return str + `${indent}}`;
  }

  *nodes() {
    for (const [_, node] of this.map) {
      yield node;
    }
  }
}

class FollowStack {
  readonly child: FollowStack | null;
  readonly thisRule: RuleName;
  readonly enterState: DState;
  private cachedHashCode: number;

  constructor(
    child: FollowStack | null,
    thisRule: RuleName,
    exitState: DState
  ) {
    this.child = child;
    this.thisRule = thisRule;
    this.enterState = exitState;
    this.cachedHashCode = 0;
  }

  hashCode(): number {
    if (this.cachedHashCode === 0) {
      const child = this.child == null ? 1 : this.child.hashCode();
      this.cachedHashCode = child * this.thisRule.length * this.enterState.id;
    }
    return this.cachedHashCode;
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    if (other instanceof FollowStack) {
      if (
        this.thisRule !== other.thisRule ||
        this.enterState !== other.enterState
      ) {
        return false;
      }
      if (this.child === null) {
        return other.child === null;
      }
      return this.child.equals(other.child);
    }
    return false;
  }

  toString() {
    const { child } = this;
    return `${this.thisRule}${child ? `,${child}` : ""}`;
  }
}

class StackFrame {
  readonly parent: StackFrame | null;
  readonly thisRule: RuleName;
  readonly state: DState;
  readonly follows: FollowStack | null;

  constructor(
    parent: StackFrame | null,
    thisRule: RuleName,
    state: DState,
    follows: FollowStack | null
  ) {
    this.parent = parent;
    this.thisRule = thisRule;
    this.state = state;
    this.follows = follows;
  }

  move(state: DState) {
    return new StackFrame(this.parent, this.thisRule, state, this.follows);
  }
}

type AnalyzerFollow = {
  readonly rule: RuleName;
  readonly enterState: DState;
  readonly exitState: DState;
};

// TODO cache stuff

export class Analyzer {
  readonly startRule: RuleName;
  readonly initialStates: Map<RuleName, DState>;
  readonly follows: Map<RuleName, AnalyzerFollow[]>;

  constructor({
    startRule,
    initialStates,
    follows,
  }: {
    startRule: RuleName;
    initialStates: Map<RuleName, DState>;
    follows: Map<RuleName, AnalyzerFollow[]>;
  }) {
    this.startRule = startRule;
    this.initialStates = initialStates;
    this.follows = follows;
  }

  private analyzeHelper(
    seen: Set<DState>,
    stack: StackFrame,
    lookahead: [RangeTransition, StackFrame][]
  ) {
    let prev: StackFrame[] = [stack];
    let next: StackFrame[] = [];

    while (prev.length) {
      for (const stack of prev) {
        if (seen.has(stack.state)) continue;
        seen.add(stack.state);

        for (const [transition, dest] of stack.state) {
          if (transition instanceof RuleTransition) {
            next.push(
              new StackFrame(
                stack.move(dest),
                transition.ruleName,
                this.initialStates.get(transition.ruleName)!!,
                stack.follows
              )
            );
          } else if (transition instanceof ReturnTransition) {
            if (stack.parent) {
              next.push(stack.parent);
            } else {
              const f = this.follows.get(stack.thisRule);
              if (f && f.length > 0) {
                for (const info of f) {
                  next.push(
                    new StackFrame(
                      null,
                      info.rule,
                      info.enterState,
                      new FollowStack(stack.follows, info.rule, info.enterState)
                    )
                  );
                }
              }
            }
          } else if (transition instanceof RangeTransition) {
            lookahead.push([transition, stack.move(dest)]);
          } else {
            next.push(stack.move(dest));
          }
        }
      }
      prev = next;
      next = [];
    }
  }

  analyze(ruleName: RuleName, state: DState, maxLL = 1) {
    const seen = new Set<DState>();
    const stack = new StackFrame(null, ruleName, state, null);
    const decisions = new DecisionsTree(1);

    for (const [goto, dest] of state) {
      const lookahead: [RangeTransition, StackFrame][] = [];

      if (goto instanceof RuleTransition) {
        this.analyzeHelper(
          seen,
          new StackFrame(
            stack.move(dest),
            goto.ruleName,
            this.initialStates.get(goto.ruleName)!!,
            null
          ),
          lookahead
        );
      } else if (goto instanceof ReturnTransition) {
        const f = this.follows.get(stack.thisRule);
        if (f && f.length > 0) {
          for (const info of f) {
            this.analyzeHelper(
              seen,
              new StackFrame(null, info.rule, info.enterState, null),
              lookahead
            );
          }
        }
      } else if (goto instanceof RangeTransition) {
        lookahead.push([goto, stack.move(dest)]);
      } else {
        this.analyzeHelper(seen, stack.move(dest), lookahead);
      }

      for (const [what, stack] of lookahead) {
        decisions.addDecision(what, goto, stack);
      }
    }

    let currentLL = 1;
    let trees = [decisions];

    while (trees.length > 0 && currentLL <= maxLL) {
      const moreTrees = [];

      for (const tree of trees) {
        for (const node of tree.nodes()) {
          if (!node.isAmbiguous()) continue;
          for (const [goto, stacks] of node.gotos) {
            const lookahead: [RangeTransition, StackFrame][] = [];
            for (const stack of stacks) {
              this.analyzeHelper(seen, stack, lookahead);
            }
            for (const [what, stack] of lookahead) {
              node.children.addDecision(what, goto, stack);
            }
          }
          moreTrees.push(node.children);
        }
      }

      trees = moreTrees;
      currentLL++;
    }

    return decisions;
  }
}
