import { DState } from "../../automaton/state";
import { AnyTransition, EpsilonTransition } from "../../automaton/transitions";
import { DFA } from "../../optimizer/abstract-optimizer";
import { first } from "../../utils";
import { BaseComponent, BaseSCC } from "./strongly-connected-components";
import { BaseTopologicalOrder } from "./topological-order";

export class CFGNode {
  readonly state: DState | null;
  readonly inEdges: Set<CFGEdge>;
  readonly outEdges: Set<CFGEdge>;
  entry: boolean;
  start: boolean;
  end: boolean;
  constructor(state: DState | null) {
    this.state = state; // state is only null for dispatch nodes
    this.inEdges = new Set();
    this.outEdges = new Set();
    this.entry = false;
    this.start = false;
    this.end = false;
  }

  forwardPredecessors() {
    let count = 0;
    for (const edge of this.inEdges) {
      if (edge.type === "forward") {
        count++;
      }
    }
    return count;
  }
}

export class DispatchTransition extends EpsilonTransition {
  constructor() {
    super();
  }
  toString() {
    return `[Dispatch]`;
  }
}

export class CFGEdge {
  start: CFGNode;
  transition: AnyTransition;
  dest: CFGNode;
  type: "forward" | "back";
  originalDest: CFGNode | null;

  constructor(
    start: CFGNode,
    transition: AnyTransition,
    dest: CFGNode,
    type: "forward" | "back"
  ) {
    this.start = start;
    this.transition = transition;
    this.dest = dest;
    this.type = type;
    this.originalDest = null;
  }

  connect() {
    this.start.outEdges.add(this);
    this.dest.inEdges.add(this);
  }

  redirectToDispatchNode(replacement: CFGNode) {
    const original = this.dest;
    original.inEdges.delete(this);
    replacement.inEdges.add(this);
    this.dest = replacement;
    this.originalDest = original;
  }
}

type CFGComponent = BaseComponent<CFGEdge, CFGNode>;

export class CFGScc extends BaseSCC<CFGEdge, CFGNode> {
  readonly nodes: ReadonlySet<CFGNode>;

  constructor(nodes: ReadonlySet<CFGNode>) {
    super();
    this.nodes = nodes;
  }

  private considerInEdge(edge: CFGEdge) {
    return edge.type === "forward" && this.nodes.has(edge.start);
  }

  private considerOutEdge(edge: CFGEdge) {
    return edge.type === "forward" && this.nodes.has(edge.dest);
  }

  *inEdges(node: CFGNode) {
    for (const edge of node.inEdges) {
      if (this.considerInEdge(edge)) {
        yield edge;
      }
    }
  }

  *destinations(node: CFGNode) {
    for (const edge of node.outEdges) {
      if (this.considerOutEdge(edge)) {
        yield edge.dest;
      }
    }
  }
}

class SccTopologicalOrder extends BaseTopologicalOrder<CFGComponent> {
  inEdgesAmount(component: CFGComponent) {
    return component.inEdgesAmount;
  }

  destinations(component: CFGComponent) {
    return component.destinations;
  }
}

export type CFGNodeOrGroup = CFGNode | CFGGroup;

export class CFGGroup {
  parent: CFGGroup | null;
  parentIdx: number | null;
  readonly entry: CFGNode;
  readonly contents: CFGNodeOrGroup[];
  constructor(
    parent: CFGGroup | null,
    parentIdx: number | null,
    entry: CFGNode,
    contents: CFGNodeOrGroup[]
  ) {
    this.parent = parent;
    this.parentIdx = parentIdx;
    this.entry = entry;
    this.contents = contents;
  }
  forwardPredecessors() {
    return this.entry.forwardPredecessors();
  }
  find(target: CFGNode, startIdx = 0): CFGNodeOrGroup {
    const { parent, parentIdx, contents } = this;
    for (let i = startIdx; i < contents.length; i++) {
      const nodes = contents[i];
      if (nodes instanceof CFGGroup) {
        if (nodes.entry === target) {
          return nodes;
        }
      } else {
        if (nodes === target) {
          return nodes;
        }
      }
    }
    if (parent == null || parentIdx == null) {
      throw new Error(`CFGGroup.find`);
    }
    return parent.find(target, parentIdx);
  }
}

export class DFAtoCFG {
  convert({
    start,
    states,
    acceptingSet,
  }: DFA<DState>): { start: CFGNode; nodes: ReadonlySet<CFGNode> } {
    const nodes = new Map<DState, CFGNode>();

    // Associate each DState with a CFGState
    for (const s of states) {
      if (s.id === 0) continue;
      const node = new CFGNode(s);
      node.entry = false;
      node.start = s === start;
      node.end = acceptingSet.has(s);
      nodes.set(s, node);
    }

    for (const [state, node] of nodes) {
      for (const [transition, dest] of state) {
        new CFGEdge(node, transition, nodes.get(dest)!!, "forward").connect();
      }
    }

    return {
      start: nodes.get(start)!!,
      nodes: new Set(nodes.values()),
    };
  }

  process(start: CFGNode, nodes: ReadonlySet<CFGNode>): CFGGroup {
    // What this function does:
    // 1. Compute multi-entry loops and add the dispatch nodes
    // 2. Distinguish forward edges from back edges
    // 3. Recursively process the interior of each component with more than one element
    //    (only considering the nodes of the component and forward edges)
    // The result is a reducible CFG
    // The function returns the nodes in topological order keeping nodes that are part of loops together
    const scc = new CFGScc(nodes);
    const components = new SccTopologicalOrder().process(scc.process(nodes));
    const group = new CFGGroup(null, null, start, []);

    for (const c of components) {
      // A SCC with more than one element is a loop
      if (c.nodes.size > 1) {
        let loopStart: CFGNode;
        // The entries are the nodes reachable from outside of the SCC

        // If there are no entries, this is the start component
        if (c.entries.size === 0) {
          if (!c.nodes.has(start)) {
            throw new Error("Component without entries without start node?");
          }
          loopStart = start;

          // Mark edges to the start as back edges
          for (const edge of scc.inEdges(loopStart)) {
            // If there are no entries, all edges are from inside
            // c.nodes.has(edge.start) === true
            edge.type = "back";
          }
        } else {
          // Compute the in-edges of the entries that come from outside or inside this SCC
          const entriesInEdges: CFGEdge[] = [];
          for (const entry of c.entries) {
            for (const edge of scc.inEdges(entry)) {
              if (c.nodes.has(edge.start)) {
                // Mark edges from inside as back edges
                edge.type = "back";
              }
              entriesInEdges.push(edge);
            }
          }

          // If there is more than one entry, we have a multiple-entry loop
          if (c.entries.size > 1) {
            loopStart = new CFGNode(null);
            loopStart.entry = true;
            // Add edges from the multi-entry to the current entries
            for (const currentEntry of c.entries) {
              new CFGEdge(
                loopStart,
                new DispatchTransition(),
                currentEntry,
                "forward"
              ).connect();
            }

            // Now take the in-edges of the entries and connect them to the dispatch node
            for (const edge of entriesInEdges) {
              edge.redirectToDispatchNode(loopStart);
            }
          } else {
            // c.entries.size === 1
            // Ensure entry is marked as entry
            loopStart = first(c.entries);
            loopStart.entry = true;
          }
        }

        const nodesToConsiderNow = new Set(c.nodes);
        nodesToConsiderNow.add(loopStart); // Make sure the multi-entry node is in this set

        const innerGroup = this.process(loopStart, nodesToConsiderNow);
        innerGroup.parent = group;
        innerGroup.parentIdx = group.contents.length;
        group.contents.push(innerGroup);
      } else {
        // Not a loop unless the state has a transition to itself
        const node = first(c.nodes);
        for (const edge of node.inEdges) {
          if (edge.start === node) {
            // Mark edges from itself as back edges
            edge.type = "back";
          }
        }
        group.contents.push(node);
      }
    }
    return group;
  }
}
