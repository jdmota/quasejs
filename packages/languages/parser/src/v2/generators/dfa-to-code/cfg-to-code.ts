import { DState } from "../../automaton/state";
import { DFA } from "../../optimizer/abstract-optimizer";
import {
  CFGEdge,
  CFGGroup,
  CFGNode,
  CFGNodeOrGroup,
  DFAtoCFG,
} from "./dfa-to-cfg";

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

type Label = number;

export type ExpectBlock = Readonly<{
  type: "expect_block";
  edge: CFGEdge;
}>;

export type SeqBlock = Readonly<{
  type: "seq_block";
  blocks: CodeBlock[];
}>;

export type DecisionBlock = Readonly<{
  type: "decision_block";
  choices: [CFGEdge | null, CodeBlock][];
  node: CFGNode;
}>;

export type ScopeBlock = Readonly<{
  type: "scope_block";
  label: Label;
  block: CodeBlock;
}>;

export type LoopBlock = Readonly<{
  type: "loop_block";
  label: Label;
  block: CodeBlock;
}>;

export type ContinueBlock = Readonly<{
  type: "continue_block";
  label: Label;
}>;

export type BreakScopeBlock = Readonly<{
  type: "break_block";
  label: Label;
}>;

export type BreakCaseBlock = Readonly<{
  type: "break_case_block";
}>;

export type ReturnBlock = Readonly<{
  type: "return_block";
}>;

export type EmptyBlock = Readonly<{
  type: "empty_block";
}>;

const empty: EmptyBlock = {
  type: "empty_block",
};

const breakCase: BreakCaseBlock = {
  type: "break_case_block",
};

function isBreakFlow(block: CodeBlock) {
  const { type } = block;
  return (
    type === "break_case_block" ||
    type === "break_block" ||
    type === "continue_block" ||
    type === "return_block"
  );
}

export function removeBreaksWithoutLabel(block: CodeBlock): CodeBlock {
  if (block.type === "seq_block") {
    const { blocks } = block;
    const lastIdx = blocks.length - 1;
    const last = blocks[lastIdx];
    if (last.type === "break_case_block") {
      return makeSeq(blocks.slice(0, lastIdx));
    }
  }
  return block;
}

// Returns the original block if the optimization failed
// The optimization removes "breaks" with this label if they are the last statement
// for every path in this block
function removeBreaksOf(block: CodeBlock, label: Label): CodeBlock {
  const fn = (b: CodeBlock) => b.type === "break_block" && b.label === label;

  if (block.type === "seq_block") {
    const { blocks } = block;
    const lastIdx = blocks.length - 1;
    const last = blocks[lastIdx];
    if (fn(last)) {
      return makeSeq(blocks.slice(0, lastIdx));
    }
    return block;
  }

  // Diamond optimization
  if (block.type === "decision_block") {
    const newChoices: [CFGEdge | null, CodeBlock][] = [];
    for (const [edge, choice] of block.choices) {
      const newChoice = removeBreaksOf(choice, label);
      if (newChoice === choice) {
        return block; // Optimization failed
      }
      newChoices.push([edge, makeSeq([newChoice, breakCase])]);
    }
    return {
      type: "decision_block",
      choices: newChoices,
      node: block.node,
    };
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

function makeScope(label: Label, block: CodeBlock): CodeBlock {
  const optimized = removeBreaksOf(block, label);
  if (optimized !== block || optimized === empty) {
    return optimized;
  }
  return {
    type: "scope_block",
    label,
    block,
  };
}

function makeLoop(label: Label, block: CodeBlock): CodeBlock {
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
  private readonly labels = new Map<CFGNode, number>();
  private labelUuid = 1;

  private getLabel(nodes: CFGNodeOrGroup) {
    let n = nodes;
    while (n instanceof CFGGroup) n = n.entry;

    const curr = this.labels.get(n);
    if (curr) return curr;
    const label = this.labelUuid++;
    this.labels.set(n, label);
    return label;
  }

  private handleNode(node: CFGNode, parent: CFGGroup): CodeBlock {
    const isFinal = node.end;
    const choices: [CFGEdge | null, CodeBlock][] = [];
    let isLoop = false;

    for (const outEdge of node.outEdges) {
      const { dest, type } = outEdge;
      if (type === "back") {
        if (node === dest) {
          isLoop = true;
        }
        choices.push([
          outEdge,
          makeSeq([
            {
              type: "expect_block",
              edge: outEdge,
            },
            {
              type: "continue_block",
              label: this.getLabel(dest),
            },
          ]),
        ]);
      } else {
        const destGroup = parent.find(dest);
        if (destGroup.forwardPredecessors() === 1) {
          // Nest the code
          choices.push([
            outEdge,
            makeSeq([
              {
                type: "expect_block",
                edge: outEdge,
              },
              this.handleNodes(destGroup, parent),
            ]),
          ]);
        } else {
          choices.push([
            outEdge,
            makeSeq([
              {
                type: "expect_block",
                edge: outEdge,
              },
              {
                type: "break_block",
                label: this.getLabel(dest),
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
          node,
        };
    }

    if (isLoop) {
      const label = this.getLabel(node);
      block = {
        type: "loop_block",
        label,
        block: makeSeq([
          block,
          {
            type: "break_block",
            label,
          },
        ]),
      };
    }

    return block;
  }

  private handleLoop(group: CFGGroup): CodeBlock {
    return makeLoop(this.getLabel(group), this.processGroup(group));
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
        makeScope(this.getLabel(nodes), lastBlock),
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
