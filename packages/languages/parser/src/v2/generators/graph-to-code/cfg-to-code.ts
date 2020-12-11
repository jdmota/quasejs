import { DState } from "../../automaton/state";
import { AnyTransition, EpsilonTransition } from "../../automaton/transitions";
import { DFA } from "../../optimizer/abstract-optimizer";
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
  private readonly entries: ReadonlySet<DState>;

  constructor(entries: ReadonlySet<DState>) {
    super();
    this.entries = entries;
  }

  inEdgesAmount(state: DState) {
    return state.inTransitions;
  }

  *destinations(state: DState) {
    for (const dest of state.destinations()) {
      if (!this.entries.has(dest)) {
        yield dest;
      }
    }
  }

  *outEdges(state: DState) {
    for (const [transition, dest] of state) {
      if (!this.entries.has(dest)) {
        yield [transition, dest] as const;
      }
    }
  }
}

class DFAtoCFG {
  process(start: DState, states: Iterable<DState>) {
    const scc = new ConnectedComponents();
    const { components, stateToComponent } = scc.process(states);
    const initialComponent = stateToComponent.get(start)!!;

    const componentToEntry = new Map<Component, CFGNode>();
    const nodes = new Map<DState, CFGNode>();
    const seen = new Set<DState>();

    // Associate each DState with a CFGState
    for (const s of states) {
      nodes.set(s, new CFGState(s));
    }

    // Compute the entries of each component
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
        componentToEntry.set(c, node);
      } else {
        if (c === initialComponent) {
          // c.entries.size === 0
          const node = nodes.get(start)!!;
          componentToEntry.set(c, node);
        } else {
          const node = nodes.get(first(c.entries))!!;
          componentToEntry.set(c, node);
        }
      }
    }

    // Connect the exits of each component to the entries of the destination components
    for (const c of components) {
      for (const [exit, transition, dest] of c.outEdges) {
        const exitNode = nodes.get(exit)!!;
        exitNode.addOutEdge(
          new CFGForwardEdge(
            exitNode,
            transition,
            componentToEntry.get(stateToComponent.get(dest)!!)!!
          )
        );
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
    const state = component.states[0];
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
        const destComponent = component.stateToComponent.get(dest)!!;
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
    if (c.states.length > 1) {
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
