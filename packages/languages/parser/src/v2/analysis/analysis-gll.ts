import { DState } from "../automaton/state.ts";
import {
  CallTransition,
  ReturnTransition,
  RangeTransition,
  AnyTransition,
} from "../automaton/transitions.ts";
import { FollowInfo } from "../grammar/follow-info.ts";
import { assertion, equals } from "../utils/index.ts";
import { Analyzer } from "./analysis.ts";
import { DecisionTokenTree } from "./decision-trees.ts";
import { FollowStack } from "./follow-stack.ts";
import { GLLBase, GLLDescriptor, IGLLLabel } from "../gll/gll-base.ts";

export type AnalysisPoint = GLLDescriptor<StateInRule>;

export class StateInRule implements IGLLLabel {
  readonly rule: string;
  readonly state: DState;
  readonly initial: boolean;
  readonly follow: FollowStack | null;
  readonly goto: AnyTransition;

  constructor(
    rule: string,
    state: DState,
    initial: boolean,
    follow: FollowStack | null,
    goto: AnyTransition
  ) {
    this.rule = rule;
    this.state = state;
    this.initial = initial;
    this.follow = follow;
    this.goto = goto;
  }

  getRule(): string {
    return this.rule;
  }

  hashCode(): number {
    return (
      this.rule.length *
      this.state.id *
      (this.follow?.hashCode() ?? 1) *
      (this.goto?.hashCode() ?? 1)
    );
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    if (other instanceof StateInRule) {
      return (
        this.rule === other.rule &&
        this.state === other.state &&
        this.initial === other.initial &&
        equals(this.goto, other.goto) &&
        equals(this.follow, other.follow)
      );
    }
    return false;
  }
}

// IT'S WORKING!!!!! (expect for ff)

// The GLL algorithm
export class AnalysisGLL extends GLLBase<StateInRule> {
  private gotos: Iterable<AnyTransition>;

  constructor(
    private readonly analyzer: Analyzer,
    private map: DecisionTokenTree<AnalysisPoint>,
    rule: string,
    state: DState,
    goto: AnyTransition
  ) {
    const initialLabel = new StateInRule(rule, state, true, null, goto);
    super(initialLabel);
    this.gotos = [goto];
  }

  setTree(
    nextTree: DecisionTokenTree<AnalysisPoint>,
    gotos: Iterable<AnyTransition>
  ) {
    this.map = nextTree;
    this.gotos = gotos;
  }

  // It is fine to use GSS nodes from previous runs because their "pos" values are smaller
  // And will not confuse with GSS nodes created in this run (which have higher "pos" values)
  doContinue(desc: GLLDescriptor<StateInRule>) {
    this.add(desc.label, desc.node, desc.pos);
    this.run();
  }

  override pop() {
    const v = this.curr;
    const k = this.pos;
    if (!super.pop()) {
      const f = this.analyzer.follows.get(v.rule);
      if (f) {
        for (const info of f) {
          const l = new StateInRule(
            info.rule,
            info.exitState,
            false,
            new FollowStack(this.analyzer, this.currL.follow, info),
            this.currL.goto
          );
          assertion(v.level === 0);
          const u = this.ensureGLLNode(info.rule, 0);
          v.addEdgeTo(l, u);
          this.add(l, u, k);
        }
      }
    }
    return true;
  }

  goto(l: StateInRule, desc: GLLDescriptor<StateInRule>): void {
    for (const [edge, destState] of l.state) {
      if (l.initial && !l.goto.equals(edge)) continue;
      const dest = new StateInRule(l.rule, destState, false, l.follow, l.goto);

      if (edge instanceof CallTransition) {
        this.create(
          dest,
          new StateInRule(
            edge.ruleName,
            this.analyzer.initialStates.get(edge.ruleName)!!,
            false,
            l.follow,
            l.goto
          )
        );
      } else if (edge instanceof ReturnTransition) {
        this.pop();
      } else if (edge instanceof RangeTransition) {
        this.map.addDecision(
          edge,
          [l.goto], // == this.gotos
          new GLLDescriptor(dest, desc.node, desc.pos + 1)
        );
      } else {
        this.add(dest, desc.node, desc.pos);
      }
    }
  }

  /*private hasSameFollow(l: StateInRule, info: FollowInfo) {
    let s: FollowStack | null = l.follow;
    while (s && s.llPhase === this.analyzer.getLLState()) {
      // If 's' is in a different phase, all childs are also in different phases
      if (s.info.id === info.id) {
        return true;
      }
      s = s.child;
    }
    return false;
  }*/
}
