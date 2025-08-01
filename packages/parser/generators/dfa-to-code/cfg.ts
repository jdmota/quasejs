import { first } from "../../../util/miscellaneous.ts";
import { BaseComponent, BaseSCC } from "./strongly-connected-components.ts";
import { BaseTopologicalOrder } from "./topological-order.ts";

export class CFGNode<Code, Decision> {
  readonly code: Code | null; // null is for a dispatch node
  readonly inEdges: Set<CFGEdge<Code, Decision>>;
  readonly outEdges: Set<CFGEdge<Code, Decision>>;
  entry: boolean;

  constructor(code: Code | null) {
    this.code = code;
    this.inEdges = new Set();
    this.outEdges = new Set();
    this.entry = false;
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

export class CFGEdge<Code, Decision> {
  start: CFGNode<Code, Decision>;
  decision: Decision | null; // null is for a dispatch decision or empty decision
  dest: CFGNode<Code, Decision>;
  type: "forward" | "back";
  originalDest: CFGNode<Code, Decision> | null;

  constructor(
    start: CFGNode<Code, Decision>,
    decision: Decision | null,
    dest: CFGNode<Code, Decision>,
    type: "forward" | "back"
  ) {
    this.start = start;
    this.decision = decision;
    this.dest = dest;
    this.type = type;
    this.originalDest = null;
  }

  connect() {
    this.start.outEdges.add(this);
    this.dest.inEdges.add(this);
  }

  redirectToDispatchNode(replacement: CFGNode<Code, Decision>) {
    const original = this.dest;
    original.inEdges.delete(this);
    replacement.inEdges.add(this);
    this.dest = replacement;
    this.originalDest = original;
  }
}

export type CFGNodeOrGroup<Code, Decision> =
  | CFGNode<Code, Decision>
  | CFGGroup<Code, Decision>;

export class CFGGroup<Code, Decision> {
  parent: CFGGroup<Code, Decision> | null;
  parentIdx: number | null;
  readonly entry: CFGNode<Code, Decision>;
  readonly contents: CFGNodeOrGroup<Code, Decision>[];
  constructor(
    parent: CFGGroup<Code, Decision> | null,
    parentIdx: number | null,
    entry: CFGNode<Code, Decision>,
    contents: CFGNodeOrGroup<Code, Decision>[]
  ) {
    this.parent = parent;
    this.parentIdx = parentIdx;
    this.entry = entry;
    this.contents = contents;
  }
  forwardPredecessors() {
    return this.entry.forwardPredecessors();
  }
  find(
    target: CFGNode<Code, Decision>,
    startIdx = 0
  ): CFGNodeOrGroup<Code, Decision> {
    const { parent, parentIdx, contents } = this;
    for (let i = startIdx; i < contents.length; i++) {
      const content = contents[i];
      if (content instanceof CFGGroup) {
        if (content.entry === target) {
          return content;
        }
      } else {
        if (content === target) {
          return content;
        }
      }
    }
    if (parent == null || parentIdx == null) {
      throw new Error(`CFGGroup.find`);
    }
    return parent.find(target, parentIdx);
  }
}

type CFGComponent<Code, Decision> = BaseComponent<
  CFGEdge<Code, Decision>,
  CFGNode<Code, Decision>
>;

class CFGScc<Code, Decision> extends BaseSCC<
  CFGEdge<Code, Decision>,
  CFGNode<Code, Decision>
> {
  readonly nodes: ReadonlySet<CFGNode<Code, Decision>>;

  constructor(nodes: ReadonlySet<CFGNode<Code, Decision>>) {
    super();
    this.nodes = nodes;
  }

  private considerInEdge(edge: CFGEdge<Code, Decision>) {
    return edge.type === "forward" && this.nodes.has(edge.start);
  }

  private considerOutEdge(edge: CFGEdge<Code, Decision>) {
    return edge.type === "forward" && this.nodes.has(edge.dest);
  }

  *inEdges(node: CFGNode<Code, Decision>) {
    for (const edge of node.inEdges) {
      if (this.considerInEdge(edge)) {
        yield edge;
      }
    }
  }

  override *destinations(node: CFGNode<Code, Decision>) {
    for (const edge of node.outEdges) {
      if (this.considerOutEdge(edge)) {
        yield edge.dest;
      }
    }
  }
}

class SccTopologicalOrder<Code, Decision> extends BaseTopologicalOrder<
  CFGComponent<Code, Decision>
> {
  inEdgesAmount(component: CFGComponent<Code, Decision>) {
    return component.inEdgesAmount;
  }

  destinations(component: CFGComponent<Code, Decision>) {
    return component.destinations;
  }
}

export function cfgToGroups<Code, Decision>(
  start: CFGNode<Code, Decision>,
  nodes: ReadonlySet<CFGNode<Code, Decision>>
): CFGGroup<Code, Decision> {
  // What this function does:
  // 1. Compute multi-entry loops and add the dispatch nodes
  // 2. Distinguish forward edges from back edges
  // 3. Recursively process the interior of each component with more than one element
  //    (only considering the nodes of the component and forward edges)
  // The result is a reducible CFG
  // The function returns the nodes in topological order keeping nodes that are part of loops together
  const scc = new CFGScc<Code, Decision>(nodes);
  const components = new SccTopologicalOrder<Code, Decision>().process(
    scc.process(nodes)
  );
  const group = new CFGGroup<Code, Decision>(null, null, start, []);

  for (const c of components) {
    // A SCC with more than one element is a loop
    if (c.nodes.size > 1) {
      let loopStart: CFGNode<Code, Decision>;
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
        // Get all edges that start in a node in "nodes" and end in one of these component's entries
        const entriesInEdges: CFGEdge<Code, Decision>[] = [];
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
          loopStart = new CFGNode<Code, Decision>(null);
          loopStart.entry = true;
          // Add edges from the multi-entry to the current entries
          for (const currentEntry of c.entries) {
            new CFGEdge(loopStart, null, currentEntry, "forward").connect();
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

      const innerGroup = cfgToGroups(loopStart, nodesToConsiderNow);
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
