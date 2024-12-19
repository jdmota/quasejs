import { DState } from "../automaton/state.ts";
import {
  CallTransition,
  ReturnTransition,
  RangeTransition,
  AnyTransition,
} from "../automaton/transitions.ts";
import { assertion, ObjectHashEquals } from "../../../../util/miscellaneous";
import { Analyzer } from "./analysis.ts";
import { DecisionTokenTree } from "./decision-trees.ts";
import {
  GLLBase,
  GLLDescriptor,
  GSSNode,
  IEnv,
  IGLLLabel,
} from "../gll/gll-base.ts";

export type AnalysisPoint = GLLDescriptor<
  StateInRule,
  AnalysisGLLArgs,
  AnalysisGLLEnv
>;

export type AnalysisGSSNode = GSSNode<
  StateInRule,
  AnalysisGLLArgs,
  AnalysisGLLEnv
>;

export class StateInRule implements IGLLLabel {
  readonly rule: string;
  readonly state: DState;
  readonly initial: boolean;

  constructor(rule: string, state: DState, initial: boolean) {
    this.rule = rule;
    this.state = state;
    this.initial = initial;
  }

  getRule(): string {
    return this.rule;
  }

  hashCode(): number {
    return this.rule.length * this.state.id;
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    if (other instanceof StateInRule) {
      return (
        this.rule === other.rule &&
        this.state === other.state &&
        this.initial === other.initial
      );
    }
    return false;
  }
}

export class AnalysisGLLEnv implements IEnv<AnalysisGLLEnv> {
  static SINGLETON = new AnalysisGLLEnv();
  assign(key: string, value: unknown): this {
    return this;
  }
  hashCode(): number {
    return 0;
  }
  equals(other: unknown): boolean {
    return this === other;
  }
}

export class AnalysisGLLArgs implements ObjectHashEquals {
  static SINGLETON = new AnalysisGLLArgs();
  hashCode(): number {
    return 0;
  }
  equals(other: unknown): boolean {
    return this === other;
  }
}

export class AnalysisGLLRet implements ObjectHashEquals {
  static SINGLETON = new AnalysisGLLRet();
  hashCode(): number {
    return 0;
  }
  equals(other: unknown): boolean {
    return this === other;
  }
}

// The GLL algorithm
export class AnalysisGLL extends GLLBase<
  StateInRule,
  AnalysisGLLArgs,
  AnalysisGLLEnv,
  AnalysisGLLRet
> {
  constructor(
    private readonly analyzer: Analyzer,
    private tree: DecisionTokenTree<AnalysisPoint>,
    private gotoTransition: AnyTransition,
    rule: string,
    state: DState
  ) {
    const initialLabel = new StateInRule(rule, state, true);
    super(initialLabel, AnalysisGLLArgs.SINGLETON, AnalysisGLLEnv.SINGLETON);
  }

  protected override createEnv(
    rule: string,
    args: AnalysisGLLArgs
  ): AnalysisGLLEnv {
    return AnalysisGLLEnv.SINGLETON;
  }

  getInitialGSS() {
    return this.curr;
  }

  // It is fine to use GSS nodes from previous runs because their "pos" values are smaller
  // And will not confuse with GSS nodes created in this run (which have higher "pos" values)
  doContinue(desc: AnalysisPoint) {
    this.add(desc.label, desc.node, desc.pos, desc.env);
    this.run();
  }

  // Returns false if it hit left recursion
  override create(
    l: StateInRule,
    dest: StateInRule,
    args: AnalysisGLLArgs
  ): boolean {
    return (
      super.create(l, dest, args) ||
      !this.ensureGLLNode(dest.getRule(), args, this.pos).hasLeftRecursion()
    );
  }

  override pop(retValue: AnalysisGLLRet) {
    const v = this.curr;
    const k = this.pos;
    if (!super.pop(retValue)) {
      const f = this.analyzer.follows.get(v.rule);
      for (const info of f) {
        const l = new StateInRule(info.rule, info.exitState, false);
        assertion(v.level === 0);
        const u = this.ensureGLLNode(info.rule, AnalysisGLLEnv.SINGLETON, 0);
        v.addEdgeTo(l, AnalysisGLLEnv.SINGLETON, u);
        this.add(l, u, k, AnalysisGLLEnv.SINGLETON);
      }
      return f.length > 0;
    }
    return true;
  }

  goto(desc: AnalysisPoint): void {
    const l = desc.label;
    assertion(l.state.transitionAmount() > 0);
    for (const [edge, destState] of l.state) {
      if (l.initial && !this.gotoTransition.equals(edge)) continue;
      const dest = new StateInRule(l.rule, destState, false);

      if (edge instanceof CallTransition) {
        if (
          !this.create(
            dest,
            new StateInRule(
              edge.ruleName,
              this.analyzer.initialStates.get(edge.ruleName)!!,
              false
            ),
            AnalysisGLLArgs.SINGLETON
          )
        ) {
          this.tree.addAny([this.gotoTransition]);
        }
      } else if (edge instanceof ReturnTransition) {
        if (!this.pop(AnalysisGLLRet.SINGLETON)) {
          this.tree.addEof([this.gotoTransition], desc);
        }
      } else if (edge instanceof RangeTransition) {
        this.tree.addDecision(
          edge,
          [this.gotoTransition],
          new GLLDescriptor(dest, desc.node, desc.pos + 1, desc.env)
        );
      } else {
        this.add(dest, desc.node, desc.pos, desc.env);
      }
    }
  }
}
