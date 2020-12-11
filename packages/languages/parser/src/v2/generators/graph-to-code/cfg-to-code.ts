import { DState } from "../../automaton/state";
import { AnyTransition, EpsilonTransition } from "../../automaton/transitions";
import { DFA } from "../../optimizer/abstract-optimizer";
import { first } from "../../utils";
import { BaseComponent, BaseSCC } from "./strongly-connected-components";
import { BaseTopologicalOrder } from "./topological-order";

abstract class CFGNode {
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

type CFGStateOpts = Readonly<{
  entry: boolean;
  start: boolean;
  end: boolean;
}>;

class CFGState extends CFGNode {
  //state: DState;
  constructor(state: DState, { entry, start, end }: CFGStateOpts) {
    super();
    //this.state = state;
    this.entry = entry;
    this.start = start;
    this.end = end;
  }
}

class CFGMultiEntry extends CFGNode {
  constructor() {
    super();
    this.entry = true;
  }
}

// Based on https://medium.com/leaningtech/solving-the-structured-control-flow-problem-once-and-for-all-5123117b1ee2

class TopologicalOrder extends BaseTopologicalOrder<Component> {
  inEdgesAmount(component: Component): number {
    return component.inEdges.length;
  }

  destinations(component: Component): IterableIterator<Component> {
    return component.destinations();
  }
}

type Component = BaseComponent<AnyTransition, DState>;

class ConnectedComponents extends BaseSCC<AnyTransition, DState> {
  inEdgesAmount(state: DState) {
    return state.inTransitions;
  }

  destinations(state: DState) {
    return state.destinations();
  }

  outEdges(state: DState) {
    return state[Symbol.iterator]();
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

  *outEdges(node: CFGNode) {
    for (const edge of node.outEdges) {
      if (this.considerOutEdge(edge)) {
        yield [edge, edge.dest] as const;
      }
    }
  }
}

class SccTopologicalOrder extends BaseTopologicalOrder<CFGComponent> {
  inEdgesAmount(component: CFGComponent) {
    return component.inEdges.length;
  }

  destinations(component: CFGComponent) {
    return component.destinations();
  }
}

type OrderedCFGNodes = CFGNode | OrderedCFGNodes[];

class DFAtoCFG {
  convert({
    start,
    states,
    acceptingSet,
  }: DFA<DState>): { start: CFGNode; nodes: ReadonlySet<CFGNode> } {
    const nodes = new Map<DState, CFGState>();

    // Associate each DState with a CFGState
    for (const s of states) {
      if (s.id === 0) continue;
      nodes.set(
        s,
        new CFGState(s, {
          entry: false,
          start: s === start,
          end: acceptingSet.has(s),
        })
      );
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

  process(start: CFGNode, nodes: ReadonlySet<CFGNode>): OrderedCFGNodes[] {
    // What this function does:
    // 1. Compute multi-entry loops and add the dispatch nodes
    // 2. Distinguish forward edges from back edges
    // 3. Recursively process the interior of each component with more than one element
    //    (only considering the nodes of the component and forward edges)
    // The result is a reducible CFG
    // The function returns the nodes in topological order keeping nodes that are part of loops together
    const scc = new CFGScc(nodes);
    const { components } = scc.process(nodes);
    const topologicalOrder = new SccTopologicalOrder().kahnsAlgorithm(
      components
    );
    const orderedNodes: OrderedCFGNodes[] = [];

    console.log(components);

    for (const c of topologicalOrder) {
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
            loopStart = new CFGMultiEntry();
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

        console.log("loop");
        console.log(loopStart);
        console.log(c.nodes);

        // FIXME the end node gets lost??...

        const nodesToConsiderNow = new Set(c.nodes);
        nodesToConsiderNow.add(loopStart); // Make sure the multi-entry node is in this set
        orderedNodes.push(this.process(loopStart, nodesToConsiderNow));
      } else {
        // Not a loop unless the state has a transition to itself
        const node = first(c.nodes);
        for (const edge of node.inEdges) {
          if (edge.start === node) {
            // Mark edges from itself as back edges
            edge.type = "back";
          }
        }
        orderedNodes.push(node);
      }
    }
    return orderedNodes;
  }
}

export type CodeBlock =
  | ExpectBlock
  | SeqBlock
  | SwitchBlock
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

export type SwitchBlock = {
  type: "switch_block";
  choices: [AnyTransition, CodeBlock][];
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

export class CfgToCode2 {
  private readonly processed = new Set<OrderedCFGNodes>();
  private readonly scopeLabels = new Map<OrderedCFGNodes, string>();
  private readonly loopLabels = new Map<OrderedCFGNodes, string>();
  private scopeLabelUuid = 1;
  private loopLabelUuid = 1;

  private readonly empty: CodeBlock = {
    type: "empty_block",
  };

  private readonly breakCase: CodeBlock = {
    type: "break_case_block",
  };

  private readonly dfa: DFA<DState>;

  constructor(dfa: DFA<DState>) {
    this.dfa = dfa;
  }

  private getScopeLabel(nodes: OrderedCFGNodes) {
    let n = nodes;
    while (Array.isArray(n)) n = n[0];

    const curr = this.scopeLabels.get(n);
    if (curr) return curr;
    const label = `s${this.scopeLabelUuid++}`;
    this.scopeLabels.set(n, label);
    return label;
  }

  private getLoopLabel(nodes: OrderedCFGNodes) {
    let n = nodes;
    while (Array.isArray(n)) n = n[0];

    const curr = this.loopLabels.get(n);
    if (curr) return curr;
    const label = `l${this.loopLabelUuid++}`;
    this.loopLabels.set(n, label);
    return label;
  }

  private makeSeq(_blocks: CodeBlock[]): CodeBlock {
    const blocks = _blocks.filter(b => b.type !== "empty_block");
    switch (blocks.length) {
      case 0:
        return this.empty;
      case 1:
        return blocks[0];
      default:
        return {
          type: "seq_block",
          blocks,
        };
    }
  }

  private makeScope(label: string, block: CodeBlock): CodeBlock {
    if (block.type === "empty_block") {
      return this.empty;
    }
    return {
      type: "scope_block",
      label,
      block,
    };
  }

  private handleLoop(nodes: OrderedCFGNodes[]): CodeBlock {
    const label = this.getLoopLabel(nodes);
    return {
      type: "loop_block",
      label,
      block: this.processList(nodes),
    };
  }

  private handleNode(node: CFGNode): CodeBlock {
    const isFinal = node.end;
    const choices: [AnyTransition, CodeBlock, boolean][] = [];
    let isLoop = false;

    for (const { transition, dest, type } of node.outEdges) {
      if (type === "back") {
        if (node === dest) {
          isLoop = true;
        }
        choices.push([
          transition,
          {
            type: "continue_block",
            label: this.getLoopLabel(dest),
          },
          false,
        ]);
      } else {
        // TODO nest if there is only one forward predecessor
        if (dest.inEdges.size === 1) {
          // Nest the code
          choices.push([transition, this.handleNodes(dest), true]);
        } else {
          choices.push([
            transition,
            {
              type: "break_scope_block",
              label: this.getScopeLabel(dest),
            },
            false,
          ]);
        }
      }
    }

    if (isFinal) {
      choices.push([new EpsilonTransition(), { type: "return_block" }, false]);
    }

    let block: CodeBlock;
    switch (choices.length) {
      case 0:
        block = this.empty;
        break;
      case 1: {
        const [transition, dest] = choices[0];
        block = this.makeSeq([
          {
            type: "expect_block",
            transition,
          },
          dest,
        ]);
        break;
      }
      default:
        block = {
          type: "switch_block",
          choices: choices.map(([t, d, breakCase]) => [
            t,
            breakCase ? this.makeSeq([d, this.breakCase]) : d,
          ]),
        };
    }

    if (isLoop) {
      const label = this.getLoopLabel(node);
      block = {
        type: "loop_block",
        label,
        block: this.makeSeq([
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

  private handleNodes(nodes: OrderedCFGNodes) {
    this.processed.add(nodes);
    if (Array.isArray(nodes)) {
      return this.handleLoop(nodes);
    } else {
      return this.handleNode(nodes);
    }
  }

  private processList(ordered: OrderedCFGNodes[]) {
    let lastBlock = this.empty;
    for (const nodes of ordered) {
      if (this.processed.has(nodes)) continue;
      lastBlock = this.makeSeq([
        this.makeScope(this.getScopeLabel(nodes), lastBlock),
        this.handleNodes(nodes),
      ]);
    }
    return lastBlock;
  }

  process() {
    const dfaToCfg = new DFAtoCFG();
    const { start, nodes } = dfaToCfg.convert(this.dfa);
    console.log(nodes);
    const ordered = dfaToCfg.process(start, nodes);
    console.log(ordered);
    return this.processList(ordered);
  }
}

export class CfgToCode {
  private readonly processed = new Set<Component>();
  private readonly scopeLabels = new Map<Component, string>();
  private readonly loopLabels = new Map<Component, string>();
  private scopeLabelUuid = 1;
  private loopLabelUuid = 1;

  private readonly empty: CodeBlock = {
    type: "empty_block",
  };

  private readonly breakCase: CodeBlock = {
    type: "break_case_block",
  };

  private readonly dfa: DFA<DState>;

  constructor(dfa: DFA<DState>) {
    this.dfa = dfa;
  }

  private getScopeLabel(c: Component) {
    const curr = this.scopeLabels.get(c);
    if (curr) return curr;
    const label = `s${this.scopeLabelUuid++}`;
    this.scopeLabels.set(c, label);
    return label;
  }

  private getLoopLabel(c: Component) {
    const curr = this.loopLabels.get(c);
    if (curr) return curr;
    const label = `l${this.loopLabelUuid++}`;
    this.loopLabels.set(c, label);
    return label;
  }

  private makeSeq(_blocks: CodeBlock[]): CodeBlock {
    const blocks = _blocks.filter(b => b.type !== "empty_block");
    switch (blocks.length) {
      case 0:
        return this.empty;
      case 1:
        return blocks[0];
      default:
        return {
          type: "seq_block",
          blocks,
        };
    }
  }

  private makeScope(label: string, block: CodeBlock): CodeBlock {
    if (block.type === "empty_block") {
      return this.empty;
    }
    return {
      type: "scope_block",
      label,
      block,
    };
  }

  private handleSingleEntryLoop(component: Component): CodeBlock {
    // c.headers.size === 1
    //const headers = component.entries;
    //const nonHeaders = component.nodes.filter(s => headers.has(s));
    //const scc = new ConnectedComponentsForLoop(headers);
    //const block = this.processStates(scc, nonHeaders);
    // TODO
    return this.empty;
  }

  private handleMultipleEntryLoop(component: Component): CodeBlock {
    // c.headers.size > 1
    //const nonHeaders = component.nodes.filter(s => component.entries.has(s));
    // TODO
    return this.empty;
  }

  private handleSequentialCode(component: Component): CodeBlock {
    // component.states.length === 1
    const state = first(component.nodes);
    const choices: [AnyTransition, CodeBlock, boolean][] = [];
    const isFinal = this.dfa.acceptingSet.has(state);
    let loopLabel: string | undefined = undefined;

    for (const [transition, dest] of state) {
      if (state === dest) {
        loopLabel = this.getLoopLabel(component);
        choices.push([
          transition,
          {
            type: "continue_block",
            label: loopLabel,
          },
          false,
        ]);
      } else {
        const destComponent = component.nodeToComponent.get(dest)!!;
        if (dest.inTransitions === 1) {
          // Nest the code
          choices.push([transition, this.handleComponent(destComponent), true]);
        } else {
          // FIXME if this goes to a loop header, it needs to be a continue
          choices.push([
            transition,
            {
              type: "break_scope_block",
              label: this.getScopeLabel(destComponent),
            },
            false,
          ]);
        }
      }
    }

    if (isFinal) {
      choices.push([new EpsilonTransition(), { type: "return_block" }, false]);
    }

    let block: CodeBlock;
    switch (choices.length) {
      case 0:
        block = this.empty;
        break;
      case 1: {
        const [transition, dest] = choices[0];
        block = this.makeSeq([
          {
            type: "expect_block",
            transition,
          },
          dest,
        ]);
        break;
      }
      default:
        block = {
          type: "switch_block",
          choices: choices.map(([t, d, breakCase]) => [
            t,
            breakCase ? this.makeSeq([d, this.breakCase]) : d,
          ]),
        };
    }

    if (loopLabel) {
      block = {
        type: "loop_block",
        label: loopLabel,
        block: this.makeSeq([
          block,
          {
            type: "break_scope_block",
            label: loopLabel,
          },
        ]),
      };
    }

    return block;
  }

  private handleComponent(c: Component) {
    this.processed.add(c);

    // SCCs with more than one element are loops
    // or with a state that can transit to itself
    // FIXME
    if (c.nodes.size > 1) {
      // The loop headers are the nodes reachable from outside of the SCC
      // If there is more than one, we have a multiple-entry loop
      if (c.entries.size > 1) {
        return this.handleMultipleEntryLoop(c);
      } else {
        // FIXME the number of entries might be zero if this is the start component
        return this.handleSingleEntryLoop(c);
      }
    } else {
      return this.handleSequentialCode(c);
    }
  }

  private processStates(
    scc: BaseSCC<AnyTransition, DState>,
    states: Iterable<DState>
  ): CodeBlock {
    // The graph of the strongly connected components forms a DAG
    const { components } = scc.process(states);
    const topologicalOrder = new TopologicalOrder().kahnsAlgorithm(components);

    let lastBlock = this.empty;

    for (const c of topologicalOrder) {
      if (this.processed.has(c)) continue;
      lastBlock = this.makeSeq([
        this.makeScope(this.getScopeLabel(c), lastBlock),
        this.handleComponent(c),
      ]);
    }

    return lastBlock;
  }

  process(): CodeBlock {
    return this.processStates(
      new ConnectedComponents(),
      this.dfa.states.slice(1)
    );
  }
}
