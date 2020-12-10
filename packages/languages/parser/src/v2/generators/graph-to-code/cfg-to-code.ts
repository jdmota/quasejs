import { DState } from "../../automaton/state";
import { AnyTransition } from "../../automaton/transitions";
import { first } from "../../utils";
import { BaseComponent, BaseSCC } from "./strongly-connected-components";
import { BaseTopologicalOrder } from "./topological-order";

abstract class CFGNode {
  readonly inEdges: CFGEdge[];
  readonly outEdges: CFGEdge[];
  constructor() {
    this.inEdges = [];
    this.outEdges = [];
  }
  addOutEdge(edge: CFGEdge): void {
    this.outEdges.push(edge);
    edge.dest.inEdges.push(edge);
  }
}

interface CFGEdge {
  readonly start: CFGNode;
  readonly dest: CFGNode;
}

class CFGForwardEdge implements CFGEdge {
  readonly start: CFGNode;
  readonly transition: AnyTransition;
  readonly dest: CFGNode;
  constructor(start: CFGNode, transition: AnyTransition, dest: CFGNode) {
    this.start = start;
    this.transition = transition;
    this.dest = dest;
  }
}

class CFGBackEdge implements CFGEdge {
  readonly start: CFGNode;
  readonly transition: AnyTransition;
  readonly dest: CFGNode;
  constructor(start: CFGNode, transition: AnyTransition, dest: CFGNode) {
    this.start = start;
    this.transition = transition;
    this.dest = dest;
  }
}

class CFGDispatchEdge implements CFGEdge {
  readonly start: CFGMultiEntry;
  readonly previous: CFGNode;
  readonly dest: CFGNode;
  constructor(start: CFGMultiEntry, previous: CFGNode, dest: CFGNode) {
    this.start = start;
    this.previous = previous;
    this.dest = dest;
  }
}

class CFGState extends CFGNode {
  readonly state: DState;
  constructor(state: DState) {
    super();
    this.state = state;
  }
}

class CFGMultiEntry extends CFGNode {}

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

class ConnectedComponentsForLoop extends BaseSCC<AnyTransition, DState> {
  private readonly headers: ReadonlySet<DState>;

  constructor(headers: ReadonlySet<DState>) {
    super();
    this.headers = headers;
  }

  inEdgesAmount(state: DState) {
    return state.inTransitions;
  }

  *destinations(state: DState) {
    for (const dest of state.destinations()) {
      if (!this.headers.has(dest)) {
        yield dest;
      }
    }
  }

  *outEdges(state: DState) {
    for (const [transition, dest] of state) {
      if (!this.headers.has(dest)) {
        yield [transition, dest] as const;
      }
    }
  }
}

class DFAtoCFG {
  process(start: DState, states: Iterable<DState>) {
    const scc = new ConnectedComponents();
    const { start: initialComponent, components } = scc.process(start, states);
    const componentToEntryNode = new Map<Component, CFGNode>();
    const nodes = new Map<DState, CFGNode>();
    const seen = new Set<DState>();

    for (const s of states) {
      nodes.set(s, new CFGState(s));
    }

    for (const c of components) {
      // The entries are the nodes reachable from outside of the SCC
      // If there is more than one, we have a multiple-entry loop
      if (c.entries.size > 1) {
        const node = new CFGMultiEntry();
        for (const [previous, _, entry] of c.inEdges) {
          node.addOutEdge(
            new CFGDispatchEdge(node, nodes.get(previous)!!, nodes.get(entry)!!)
          );
        }
        componentToEntryNode.set(c, node);
      } else {
        const node = nodes.get(first(c.entries))!!;
        componentToEntryNode.set(c, node);
      }
    }

    function visit(state: DState) {
      seen.add(state);
      const node = nodes.get(state)!!;
      for (const [t, dest] of state) {
        if (seen.has(dest)) {
          node.addOutEdge(new CFGBackEdge(node, t, nodes.get(dest)!!));
        } else {
          node.addOutEdge(new CFGForwardEdge(node, t, nodes.get(dest)!!));
        }
      }
    }
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

export type EmptyBlock = {
  type: "empty_block";
};

export class CfgToCode {
  private readonly processed = new Set<Component>();
  private readonly labels = new Map<Component, string>();
  private labelUuid = 1;

  private readonly empty: CodeBlock = {
    type: "empty_block",
  };

  private readonly breakCase: CodeBlock = {
    type: "break_case_block",
  };

  private getLabel(c: Component) {
    const curr = this.labels.get(c);
    if (curr) return curr;
    const label = `l${this.labelUuid++}`;
    this.labels.set(c, label);
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
    const headers = component.entries;
    const nonHeaders = component.states.filter(s => headers.has(s));
    const scc = new ConnectedComponentsForLoop(headers);
    const block = this.processStates(scc, nonHeaders);
    // TODO
    return {
      type: "loop_block",
      label: "",
      block,
    };
  }

  private handleMultipleEntryLoop(component: Component): CodeBlock {
    // c.headers.size > 1
    const nonHeaders = component.states.filter(s => component.entries.has(s));
    // TODO
    return {
      type: "loop_block",
      label: "",
      block: this.empty,
    };
  }

  private handleSequentialCode(component: Component): CodeBlock {
    // component.states.length === 1
    // const state = component.states[0];
    const choices: [AnyTransition, CodeBlock, boolean][] = [];

    for (const [transition, dest] of component) {
      if (dest.inEdges.length === 1) {
        // Nest the code
        choices.push([transition, this.handleComponent(dest), true]);
      } else {
        choices.push([
          transition,
          {
            type: "break_scope_block",
            label: this.getLabel(dest),
          },
          false,
        ]);
      }
    }

    if (choices.length === 0) {
      return this.empty;
    }

    if (choices.length === 1) {
      const [transition, dest] = choices[0];
      return this.makeSeq([
        {
          type: "expect_block",
          transition,
        },
        dest,
      ]);
    }

    return {
      type: "switch_block",
      choices: choices.map(([t, d, breakCase]) => [
        t,
        breakCase ? this.makeSeq([d, this.breakCase]) : d,
      ]),
    };
  }

  private handleComponent(c: Component) {
    this.processed.add(c);

    // SCCs with more than one element are loops
    if (c.states.length > 1) {
      // The loop headers are the nodes reachable from outside of the SCC
      // If there is more than one, we have a multiple-entry loop
      if (c.entries.size > 1) {
        return this.handleMultipleEntryLoop(c);
      } else {
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
        this.makeScope(this.getLabel(c), lastBlock),
        this.handleComponent(c),
      ]);
    }

    return lastBlock;
  }

  process(states: Iterable<DState>): CodeBlock {
    return this.processStates(new ConnectedComponents(), states);
  }
}
