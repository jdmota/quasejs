import {
  type ObjectHashEquals,
  equals,
  first,
  nonNull,
} from "../../util/miscellaneous.ts";
import { MapKeyToValue } from "../../util/data-structures/map-key-to-value.ts";
import { DState } from "../automaton/state.ts";
import {
  BaseCFGNode,
  BaseCFGEdge,
  BaseCFGGroup,
  type BaseCFGNodeOrGroup,
} from "../../util/cfg-and-code/cfg.ts";
import { IAnalyzer } from "../analysis/analysis-reference.ts";
import { type AugmentedDeclaration } from "../grammar/grammar.ts";
import { type AnyTransition } from "../automaton/transitions.ts";
import {
  DecisionFollowTree,
  DecisionTokenTree,
  type DecisionTree,
} from "../analysis/decision-trees.ts";
import { type DecisionExpr } from "../analysis/decision-expr.ts";
import { LabelsManager } from "./labels-manager.ts";

export type ConditionalBlock = Readonly<{
  type: "conditional_block";
  state: DState;
  decisionOn: "ll" | "ff";
  decisionIdx: number;
}>;

export type RegularBlock = Readonly<{
  type: "regular_block";
  transition: AnyTransition;
  dest: DState;
}>;

export type AmbiguityBlock = Readonly<{
  type: "ambiguity_block";
  choices: readonly Readonly<{ transition: AnyTransition; label: number }>[];
}>;

export type JumpBlock = Readonly<{
  type: "jump_block";
  label: number;
}>;

export type CFGNodeCode =
  | ConditionalBlock
  | RegularBlock
  | AmbiguityBlock
  | JumpBlock;

export type GrammarCFGNode = BaseCFGNode<CFGNodeCode, DecisionExpr>;

export type GrammarCFGEdge = BaseCFGEdge<CFGNodeCode, DecisionExpr>;

export type GrammarCFGGroup = BaseCFGGroup<CFGNodeCode, DecisionExpr>;

export type GrammarCFGNodeOrGroup = BaseCFGNodeOrGroup<
  CFGNodeCode,
  DecisionExpr
>;

type RegularNode = BaseCFGNode<RegularBlock, DecisionExpr>;

export class DStateEdge implements ObjectHashEquals {
  readonly transition: AnyTransition | null;
  readonly dest: DState;

  constructor(transition: AnyTransition | null, dest: DState) {
    this.transition = transition;
    this.dest = dest;
  }

  hashCode(): number {
    return (this.transition ? this.transition.hashCode() : 1) * this.dest.id;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof DStateEdge &&
      this.dest === other.dest &&
      equals(this.transition, other.transition)
    );
  }
}

export function convertDFAtoCFG(
  analyzer: IAnalyzer<any>,
  needGLL: ReadonlySet<string>,
  rule: AugmentedDeclaration,
  labels: LabelsManager,
  transition: AnyTransition | null,
  state: DState,
  canUseFollow: boolean,
  usesFollow: { ref: boolean }
): Readonly<{ start: GrammarCFGNode; nodes: ReadonlySet<GrammarCFGNode> }> {
  const weNeedGLL = needGLL.has(rule.name);
  const nodes: Set<GrammarCFGNode> = new Set();

  function newNode<T extends CFGNodeCode>(code: T) {
    const node = new BaseCFGNode<T, DecisionExpr>(code);
    nodes.add(node);
    return node;
  }

  const stateToNode = new Map<DState, GrammarCFGNode>();
  const cache = new MapKeyToValue<DStateEdge, RegularNode>();
  let queue: RegularNode[] = [];

  const startNode = transition
    ? newRegularBlock(transition, state)
    : makeNodeFromState(state, true);

  function newRegularBlock(transition: AnyTransition, dest: DState) {
    let cached = true;
    const node = cache.computeIfAbsent(new DStateEdge(transition, dest), () => {
      cached = false;
      return newNode({
        type: "regular_block",
        transition,
        dest,
      });
    });
    if (!cached) {
      labels.needsGLLCall(
        transition,
        t => {
          // Handle the label for when we return from this call
          // And do not queue the node (so that we cut the code there)
          labels.add(t, dest);
        },
        t => {
          if (dest.transitionAmount() > 0) {
            queue.push(node);
          }
        }
      );
    }
    return node;
  }

  function newGotoBlock(state: DState, gotos: readonly AnyTransition[]) {
    gotos = [...new Set(gotos)];
    if (gotos.length === 1) {
      const goto = gotos[0];
      const dest = nonNull(state.getDestination(goto));
      return newRegularBlock(goto, dest);
    }
    return newNode({
      type: "ambiguity_block",
      choices: gotos.map(g => ({
        transition: g,
        label: labels.add(g, nonNull(state.getDestination(g))),
      })),
    });
  }

  function newConditionalBlock(state: DState) {
    const { tree } = analyzer.analyze(rule, state);

    function processTree(tree: DecisionTree<any>) {
      const node = newNode({
        type: "conditional_block",
        state,
        decisionOn: tree instanceof DecisionTokenTree ? "ll" : "ff",
        decisionIdx: tree instanceof DecisionTokenTree ? tree.ll : tree.ff,
      });
      const anyGotos = [...tree.iterateAny()]; // Deal the left recursive rules
      for (const decision of tree.iterate()) {
        const expr = decision.decision;
        let nextNode: GrammarCFGNode;
        if (anyGotos.length) {
          nextNode = newGotoBlock(state, [...anyGotos, ...decision.getGotos()]);
        } else if (decision.isAmbiguous()) {
          const tree = decision.getNextTree();
          if (tree instanceof DecisionTokenTree) {
            nextNode = tree?.worthIt()
              ? processTree(tree)
              : newGotoBlock(state, decision.getGotos());
          } else if (canUseFollow && tree instanceof DecisionFollowTree) {
            usesFollow.ref = true;
            nextNode = tree?.worthIt()
              ? processTree(tree)
              : newGotoBlock(state, decision.getGotos());
          } else {
            nextNode = newGotoBlock(state, decision.getGotos());
          }
        } else {
          nextNode = newGotoBlock(state, [decision.getSingleGoto()]);
        }
        new BaseCFGEdge(node, expr, nextNode, "forward").connect();
      }
      return node;
    }

    return processTree(tree);
  }

  function makeNodeFromState(state: DState, start: boolean): GrammarCFGNode {
    let node = stateToNode.get(state);
    if (!node) {
      if (weNeedGLL && !start && state.inTransitions > 1) {
        // This is an optimization to reduce repeated code
        node = newNode({
          type: "jump_block",
          label: labels.add(null, state),
        });
      } else {
        if (state.transitionAmount() === 1) {
          const [transition, dest] = first(state);
          node = newRegularBlock(transition, dest);
        } else {
          node = newConditionalBlock(state);
        }
      }
      stateToNode.set(state, node);
    }
    return node;
  }

  while (queue.length > 0) {
    const node = queue.pop()!;
    const destNode = makeNodeFromState(node.code!.dest, false);
    new BaseCFGEdge(node, null, destNode, "forward").connect();
  }

  return {
    start: startNode,
    nodes,
  };
}
