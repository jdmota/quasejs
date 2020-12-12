import { DState } from "../../automaton/state";
import { AnyTransition, EpsilonTransition } from "../../automaton/transitions";
import { DFA } from "../../optimizer/abstract-optimizer";
import { first } from "../../utils";
import { BaseComponent, BaseSCC } from "./strongly-connected-components";
import { BaseTopologicalOrder } from "./topological-order";

class CFGNode {
  inEdges: Set<CFGEdge>;
  outEdges: Set<CFGEdge>;
  entry: boolean;
  start: boolean;
  end: boolean;
  constructor() {
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

class DispatchTransition extends EpsilonTransition {
  constructor() {
    super();
  }
  toString() {
    return `[Dispatch]`;
  }
}

class CFGEdge {
  start: CFGNode;
  transition: AnyTransition;
  dest: CFGNode;
  type: "forward" | "back";
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
  }

  connect() {
    this.start.outEdges.add(this);
    this.dest.inEdges.add(this);
  }

  changeDestination(replacement: CFGNode) {
    const original = this.dest;
    original.inEdges.delete(this);
    replacement.inEdges.add(this);
    this.dest = replacement;
  }
}

type CFGComponent = BaseComponent<CFGEdge, CFGNode>;

class CFGScc extends BaseSCC<CFGEdge, CFGNode> {
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

type CFGNodeOrGroup = CFGNode | CFGGroup;

class CFGGroup {
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

class DFAtoCFG {
  convert({
    start,
    states,
    acceptingSet,
  }: DFA<DState>): { start: CFGNode; nodes: ReadonlySet<CFGNode> } {
    const nodes = new Map<DState, CFGNode>();

    // Associate each DState with a CFGState
    for (const s of states) {
      if (s.id === 0) continue;
      const node = new CFGNode();
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
            loopStart = new CFGNode();
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
              edge.changeDestination(loopStart);
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

export type CodeBlock =
  | ExpectBlock
  | SeqBlock
  | DecisionBlock
  | ScopeBlock
  | LoopBlock
  | ContinueBlock
  | BreakScopeBlock
  | BreakCaseBlock
  | ReturnBlock
  | EmptyBlock;

export type ExpectBlock = {
  type: "expect_block";
  transition: AnyTransition;
};

export type SeqBlock = {
  type: "seq_block";
  blocks: CodeBlock[];
};

export type DecisionBlock = {
  type: "decision_block";
  choices: [AnyTransition | null, CodeBlock][];
};

export type ScopeBlock = {
  type: "scope_block";
  label: string;
  block: CodeBlock;
};

export type LoopBlock = {
  type: "loop_block";
  label: string;
  block: CodeBlock;
};

export type ContinueBlock = {
  type: "continue_block";
  label: string;
};

export type BreakScopeBlock = {
  type: "break_scope_block";
  label: string;
};

export type BreakCaseBlock = {
  type: "break_case_block";
};

export type ReturnBlock = {
  type: "return_block";
};

export type EmptyBlock = {
  type: "empty_block";
};

const empty: EmptyBlock = {
  type: "empty_block",
};

const breakCase: BreakCaseBlock = {
  type: "break_case_block",
};

function isBreakFlow(block: CodeBlock) {
  const { type } = block;
  return (
    type === "break_scope_block" ||
    type === "break_case_block" ||
    type === "continue_block" ||
    type === "return_block"
  );
}

function removeLastBlock(
  block: CodeBlock,
  fn: (b: CodeBlock) => boolean
): CodeBlock {
  if (block.type === "seq_block") {
    const { blocks } = block;
    const lastIdx = blocks.length - 1;
    const last = blocks[lastIdx];
    if (fn(last)) {
      return makeSeq(blocks.slice(0, lastIdx));
    }
    return block;
  }
  if (fn(block)) {
    return empty;
  }
  return block;
}

function makeSeq(_blocks: CodeBlock[]): CodeBlock {
  const blocks = _blocks
    .flatMap(b => (b.type === "seq_block" ? b.blocks : b))
    .filter(b => b.type !== "empty_block");
  switch (blocks.length) {
    case 0:
      return empty;
    case 1:
      return blocks[0];
    default: {
      const firstBreakOrContinue = blocks.findIndex(isBreakFlow);
      return {
        type: "seq_block",
        blocks:
          firstBreakOrContinue === -1
            ? blocks
            : blocks.slice(0, firstBreakOrContinue + 1),
      };
    }
  }
}

function makeScope(label: string, _block: CodeBlock): CodeBlock {
  const block = removeLastBlock(
    _block,
    b => b.type === "break_scope_block" && b.label === label
  );
  if (block.type === "empty_block") {
    return empty;
  }
  return {
    type: "scope_block",
    label,
    block,
  };
}

function makeLoop(label: string, block: CodeBlock): CodeBlock {
  if (block.type === "empty_block") {
    throw new Error(`Empty infinite loop?`);
  }
  return {
    type: "loop_block",
    label,
    block,
  };
}

export class CfgToCode {
  private readonly processed = new Set<CFGNodeOrGroup>();
  private readonly scopeLabels = new Map<CFGNode, string>();
  private readonly loopLabels = new Map<CFGNode, string>();
  private scopeLabelUuid = 1;
  private loopLabelUuid = 1;

  private getScopeLabel(nodes: CFGNodeOrGroup) {
    let n = nodes;
    while (n instanceof CFGGroup) n = n.entry;

    const curr = this.scopeLabels.get(n);
    if (curr) return curr;
    const label = `s${this.scopeLabelUuid++}`;
    this.scopeLabels.set(n, label);
    return label;
  }

  private getLoopLabel(nodes: CFGNodeOrGroup) {
    let n = nodes;
    while (n instanceof CFGGroup) n = n.entry;

    const curr = this.loopLabels.get(n);
    if (curr) return curr;
    const label = `l${this.loopLabelUuid++}`;
    this.loopLabels.set(n, label);
    return label;
  }

  // TODO optimize diamonds to reduce the number of necessary scopes
  private handleNode(node: CFGNode, parent: CFGGroup): CodeBlock {
    const isFinal = node.end;
    const choices: [AnyTransition | null, CodeBlock][] = [];
    let isLoop = false;

    for (const { transition, dest, type } of node.outEdges) {
      if (type === "back") {
        if (node === dest) {
          isLoop = true;
        }
        choices.push([
          transition,
          makeSeq([
            {
              type: "expect_block",
              transition,
            },
            {
              type: "continue_block",
              label: this.getLoopLabel(dest),
            },
          ]),
        ]);
      } else {
        const destGroup = parent.find(dest);
        if (destGroup.forwardPredecessors() === 1) {
          // Nest the code
          choices.push([
            transition,
            makeSeq([
              {
                type: "expect_block",
                transition,
              },
              this.handleNodes(destGroup, parent),
            ]),
          ]);
        } else {
          choices.push([
            transition,
            makeSeq([
              {
                type: "expect_block",
                transition,
              },
              {
                type: "break_scope_block",
                label: this.getScopeLabel(dest),
              },
            ]),
          ]);
        }
      }
    }

    if (isFinal) {
      choices.push([null, { type: "return_block" }]);
    }

    let block: CodeBlock;
    switch (choices.length) {
      case 0:
        block = empty;
        break;
      case 1: {
        const [_, dest] = choices[0];
        block = dest;
        break;
      }
      default:
        block = {
          type: "decision_block",
          choices: choices.map(([t, d]) => [t, makeSeq([d, breakCase])]),
        };
    }

    if (isLoop) {
      const label = this.getLoopLabel(node);
      block = {
        type: "loop_block",
        label,
        block: makeSeq([
          block,
          {
            type: "break_scope_block",
            label,
          },
        ]),
      };
    }

    return block;
  }

  private handleLoop(group: CFGGroup): CodeBlock {
    return makeLoop(this.getLoopLabel(group), this.processGroup(group));
  }

  private handleNodes(nodes: CFGNodeOrGroup, parent: CFGGroup) {
    this.processed.add(nodes);
    if (nodes instanceof CFGGroup) {
      return this.handleLoop(nodes);
    } else {
      return this.handleNode(nodes, parent);
    }
  }

  private processGroup(ordered: CFGGroup) {
    let lastBlock: CodeBlock = empty;
    for (const nodes of ordered.contents) {
      if (this.processed.has(nodes)) continue;
      lastBlock = makeSeq([
        makeScope(this.getScopeLabel(nodes), lastBlock),
        this.handleNodes(nodes, ordered),
      ]);
    }
    return lastBlock;
  }

  process(dfa: DFA<DState>) {
    const dfaToCfg = new DFAtoCFG();
    const { start, nodes } = dfaToCfg.convert(dfa);
    const ordered = dfaToCfg.process(start, nodes);
    return this.processGroup(ordered);
  }
}
