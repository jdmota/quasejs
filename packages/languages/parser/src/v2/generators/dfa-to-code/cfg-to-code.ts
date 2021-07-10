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
  | ReturnBlock
  | EmptyBlock;

type Label = string;

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
  choices: [CFGEdge, CodeBlock][];
  default: CodeBlock | null;
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

export type ReturnBlock = Readonly<{
  type: "return_block";
}>;

export type EmptyBlock = Readonly<{
  type: "empty_block";
}>;

const empty: EmptyBlock = {
  type: "empty_block",
};

function isBreakFlow(block: CodeBlock) {
  const { type } = block;
  return (
    type === "break_block" ||
    type === "continue_block" ||
    type === "return_block"
  );
}

export function endsWithFlowBreak(block: CodeBlock): boolean {
  if (block.type === "seq_block") {
    const { blocks } = block;
    const lastIdx = blocks.length - 1;
    const last = blocks[lastIdx];
    return isBreakFlow(last);
  }
  if (block.type === "decision_block") {
    return (
      block.choices.every(([_, c]) => endsWithFlowBreak(c)) &&
      (block.default == null || endsWithFlowBreak(block.default))
    );
  }
  return isBreakFlow(block);
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
    const newChoices: [CFGEdge, CodeBlock][] = [];
    let newDefaultChoice: CodeBlock | null = null;
    for (const [edge, choice] of block.choices) {
      const newChoice = removeBreaksOf(choice, label);
      if (newChoice === choice) {
        return block; // Optimization failed
      }
      newChoices.push([edge, newChoice]);
    }
    if (block.default) {
      newDefaultChoice = removeBreaksOf(block.default, label);
      if (newDefaultChoice === block.default) {
        return block; // Optimization failed
      }
    }
    return {
      type: "decision_block",
      choices: newChoices,
      default: newDefaultChoice,
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
  if (optimized.type === "empty_block") {
    return empty;
  }
  return {
    type: "scope_block",
    label,
    block: optimized,
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
  private readonly scopeLabels = new Map<CFGNode, number>();
  private readonly loopLabels = new Map<CFGNode, number>();
  private scopeLabelUuid = 1;
  private loopLabelUuid = 1;

  private getScopeLabel(nodes: CFGNodeOrGroup): string {
    let n = nodes;
    while (n instanceof CFGGroup) n = n.entry;

    const curr = this.scopeLabels.get(n);
    if (curr) return `s${curr}`;
    const label = this.scopeLabelUuid++;
    this.scopeLabels.set(n, label);
    return `s${label}`;
  }

  private getLoopLabel(nodes: CFGNodeOrGroup): string {
    let n = nodes;
    while (n instanceof CFGGroup) n = n.entry;

    const curr = this.loopLabels.get(n);
    if (curr) return `l${curr}`;
    const label = this.loopLabelUuid++;
    this.loopLabels.set(n, label);
    return `l${label}`;
  }

  private handleNode(node: CFGNode, parent: CFGGroup): CodeBlock {
    const isFinal = node.end;
    const choices: [CFGEdge, CodeBlock][] = [];
    let defaultChoice: CodeBlock | null = null;
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
              label: this.getLoopLabel(dest),
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
                label: this.getScopeLabel(dest),
              },
            ]),
          ]);
        }
      }
    }

    if (isFinal) {
      defaultChoice = { type: "return_block" };
    }

    let block: CodeBlock;
    switch (choices.length) {
      case 0:
        block = defaultChoice ?? empty;
        break;
      case 1:
        if (defaultChoice == null) {
          const [_, dest] = choices[0];
          block = dest;
          break;
        }
      default:
        block = {
          type: "decision_block",
          choices,
          default: defaultChoice,
          node,
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
            type: "break_block",
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
