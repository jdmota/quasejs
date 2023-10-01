import { DState, EPSILON } from "../../automaton/state";
import { AnyTransition } from "../../automaton/transitions";
import { DFA } from "../../optimizer/abstract-optimizer";
import { ObjectHashEquals, first, nonNull } from "../../utils";
import { MapKeyToValue } from "../../utils/map-key-to-value";
import { CFGNode, CFGEdge, CFGGroup, CFGNodeOrGroup } from "./cfg";

export type ConditionalBlock = Readonly<{
  type: "conditional_block";
  state: DState;
}>;

export type RegularBlock = Readonly<{
  type: "regular_block";
  expr: AnyTransition;
  dest: DState;
}>;

export type CFGNodeCode = ConditionalBlock | RegularBlock;

export type ParserCFGNode = CFGNode<CFGNodeCode, AnyTransition>;

export type ParserCFGEdge = CFGEdge<CFGNodeCode, AnyTransition>;

export type ParserCFGGroup = CFGGroup<CFGNodeCode, AnyTransition>;

export type ParserCFGNodeOrGroup = CFGNodeOrGroup<CFGNodeCode, AnyTransition>;

type RegularNode = CFGNode<RegularBlock, AnyTransition>;

class DStateEdge implements ObjectHashEquals {
  readonly transition: AnyTransition;
  readonly dest: DState;

  constructor(transition: AnyTransition, dest: DState) {
    this.transition = transition;
    this.dest = dest;
  }

  hashCode(): number {
    return this.transition.hashCode() * this.dest.id;
  }

  equals(other: unknown): boolean {
    return (
      other instanceof DStateEdge &&
      this.dest === other.dest &&
      this.transition.equals(other.transition)
    );
  }
}

// Since all rules end with a return expression, there will be only one accepting state with exactly zero out edges
export function convertDFAtoCFG({ start, states, acceptingSet }: DFA<DState>): {
  start: ParserCFGNode;
  nodes: ReadonlySet<ParserCFGNode>;
} {
  const nodes: ParserCFGNode[] = [];
  const stateToNode = new Map<DState, ParserCFGNode>();
  const cache = new MapKeyToValue<DStateEdge, RegularNode>();
  const regulars: RegularNode[] = [];

  for (const s of states) {
    if (s.id === 0) continue;
    if (s.transitionAmount() === 1) {
      const [transition, dest] = first(s);
      const dstateEdge = new DStateEdge(transition, dest);
      const node = cache.computeIfAbsent(dstateEdge, () => {
        const node: RegularNode = new CFGNode({
          type: "regular_block",
          expr: transition,
          dest,
        });
        nodes.push(node);
        regulars.push(node);
        return node;
      });
      stateToNode.set(s, node);
    } else {
      const node: ParserCFGNode = new CFGNode({
        type: "conditional_block",
        state: s,
      });
      nodes.push(node);
      stateToNode.set(s, node);
      for (const [transition, dest] of s) {
        const dstateEdge = new DStateEdge(transition, dest);
        const destNode = cache.computeIfAbsent(dstateEdge, () => {
          const destNode: RegularNode = new CFGNode({
            type: "regular_block",
            expr: transition,
            dest,
          });
          nodes.push(destNode);
          regulars.push(destNode);
          return destNode;
        });
        new CFGEdge(node, transition, destNode, "forward").connect();
      }
    }
  }

  for (const regular of regulars) {
    new CFGEdge(
      regular,
      EPSILON,
      nonNull(stateToNode.get(nonNull(regular.code).dest)),
      "forward"
    ).connect();
  }

  return {
    start: nonNull(stateToNode.get(start)),
    nodes: new Set(nodes),
  };
}
