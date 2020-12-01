import { DState } from "../../automaton/state";
import { AnyTransition } from "../../automaton/transitions";
import { DFA } from "../../optimizer/abstract-optimizer";
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

type CodeBlock = BasicBlock | SeqBlock | LoopBlock;

type BasicBlock = {
  type: "basic_block";
  state: DState;
};

type SeqBlock = {
  type: "seq_block";
  blocks: CodeBlock[];
};

type LoopBlock = {
  type: "loop_block";
  block: CodeBlock;
};

function handleSingleEntryLoop(component: Component) {
  // TODO
}

function handleMultipleEntryLoop(component: Component) {
  // TODO
}

function handleSequentialCode(component: Component): CodeBlock {
  // component.states.length === 1
  const state = component.states[0];
  return {
    type: "basic_block",
    state,
  };
}

export function cfgToCode({
  states,
  start,
  acceptingSet,
}: DFA<DState>): CodeBlock {
  // The graph of the strongly connected components forms a DAG
  const components = new ConnectedComponents().process(states);
  const topologicalOrder = new TopologicalOrder().process(components);

  const blocks: CodeBlock[] = [];

  for (const c of topologicalOrder) {
    // SCCs with more than one element are loops
    if (c.states.length > 1) {
      // Identify all the loop headers, which are the nodes reachable from outside of the SCC
      // If there is more than one, we have a multiple-entry loop
      if (c.headers.size > 1) {
        handleMultipleEntryLoop(c);
      } else {
        handleSingleEntryLoop(c);
      }
    } else {
      handleSequentialCode(c);
    }
  }

  if (blocks.length > 1) {
    return {
      type: "seq_block",
      blocks,
    };
  } else {
    return blocks[0];
  }
}
