import { DState } from "../../automaton/state";
import { AnyTransition } from "../../automaton/transitions";
import { BaseComponent, BaseSCC } from "./strongly-connected-components";
import { BaseTopologicalOrder } from "./topological-order";

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
  inEdgesAmount(state: DState): number {
    return state.inTransitions;
  }

  destinations(state: DState): IterableIterator<DState> {
    return state.destinations();
  }

  outEdges(state: DState): IterableIterator<readonly [AnyTransition, DState]> {
    return state[Symbol.iterator]();
  }
}

export type CodeBlock =
  | ExpectBlock
  | SeqBlock
  | SwitchBlock
  | ScopeBlock
  | LoopBlock
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
  block: CodeBlock;
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
    // TODO
    return this.empty;
  }

  private handleMultipleEntryLoop(component: Component): CodeBlock {
    // TODO
    return this.empty;
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
      if (c.headers.size > 1) {
        return this.handleMultipleEntryLoop(c);
      } else {
        return this.handleSingleEntryLoop(c);
      }
    } else {
      return this.handleSequentialCode(c);
    }
  }

  process(states: readonly DState[]): CodeBlock {
    // The graph of the strongly connected components forms a DAG
    const { components } = new ConnectedComponents().process(states);
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
}
