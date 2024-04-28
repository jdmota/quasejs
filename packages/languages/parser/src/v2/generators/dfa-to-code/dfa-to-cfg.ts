import { AbstractDFAState } from "../../automaton/state.ts";
import { DFA } from "../../optimizer/abstract-optimizer.ts";
import {
  ObjectHashEquals,
  assertion,
  equals,
  first,
  nonNull,
} from "../../utils/index.ts";
import { MapKeyToValue } from "../../utils/map-key-to-value.ts";
import { CFGNode, CFGEdge, CFGGroup, CFGNodeOrGroup } from "./cfg.ts";

export type ConditionalBlock<S> = Readonly<{
  type: "conditional_block";
  state: S;
}>;

export type RegularBlock<S, T> = Readonly<{
  type: "regular_block";
  expr: T;
  dest: S;
  final: boolean;
}>;

export type CFGNodeCode<S, T> = ConditionalBlock<S> | RegularBlock<S, T>;

export type ParserCFGNode<S, T> = CFGNode<CFGNodeCode<S, T>, T>;

export type ParserCFGEdge<S, T> = CFGEdge<CFGNodeCode<S, T>, T>;

export type ParserCFGGroup<S, T> = CFGGroup<CFGNodeCode<S, T>, T>;

export type ParserCFGNodeOrGroup<S, T> = CFGNodeOrGroup<CFGNodeCode<S, T>, T>;

type RegularNode<S, T> = CFGNode<RegularBlock<S, T>, T>;

class DStateEdge<S extends AbstractDFAState<S, T>, T extends ObjectHashEquals>
  implements ObjectHashEquals
{
  readonly transition: T | null;
  readonly dest: S;

  constructor(transition: T | null, dest: S) {
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

// Since all rules end with a return expression, there will be only one accepting state with exactly zero out edges
export function convertDFAtoCFG<
  S extends AbstractDFAState<S, T>,
  T extends ObjectHashEquals,
>({
  start,
  states,
  acceptingSet,
}: DFA<S>): {
  start: ParserCFGNode<S, T>;
  nodes: ReadonlySet<ParserCFGNode<S, T>>;
} {
  for (const state of acceptingSet) {
    assertion(state.transitionAmount() === 0);
  }

  const nodes: ParserCFGNode<S, T>[] = [];
  const stateToNode = new Map<S, ParserCFGNode<S, T>>();
  const cache = new MapKeyToValue<DStateEdge<S, T>, RegularNode<S, T>>();
  const regulars: RegularNode<S, T>[] = [];

  for (const s of states) {
    if (s.id === 0) continue;
    if (s.transitionAmount() === 1) {
      const [transition, dest] = first(s);
      const dstateEdge = new DStateEdge<S, T>(transition, dest);
      const node = cache.computeIfAbsent(dstateEdge, () => {
        const node: RegularNode<S, T> = new CFGNode({
          type: "regular_block",
          expr: transition,
          dest,
          final: acceptingSet.has(dest),
        });
        nodes.push(node);
        regulars.push(node);
        return node;
      });
      stateToNode.set(s, node);
    } else {
      const node: ParserCFGNode<S, T> = new CFGNode({
        type: "conditional_block",
        state: s,
      });
      nodes.push(node);
      stateToNode.set(s, node);
      for (const [transition, dest] of s) {
        const dstateEdge = new DStateEdge(transition, dest);
        const destNode = cache.computeIfAbsent(dstateEdge, () => {
          const destNode: RegularNode<S, T> = new CFGNode({
            type: "regular_block",
            expr: transition,
            dest,
            final: acceptingSet.has(dest),
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
      null,
      nonNull(stateToNode.get(nonNull(regular.code).dest)),
      "forward"
    ).connect();
  }

  return {
    start: nonNull(stateToNode.get(start)),
    nodes: new Set(nodes),
  };
}
