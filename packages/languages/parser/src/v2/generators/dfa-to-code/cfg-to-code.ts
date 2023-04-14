import { DState } from "../../automaton/state";
import { ReturnTransition } from "../../automaton/transitions";
import { DFA } from "../../optimizer/abstract-optimizer";
import { assertion, never } from "../../utils";
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
    type === "return_block" ||
    (block.type === "expect_block" &&
      block.edge.transition instanceof ReturnTransition)
  );
}

export function endsWithFlowBreak(block: CodeBlock): boolean {
  if (block.type === "seq_block") {
    const { blocks } = block;
    const last = blocks[blocks.length - 1];
    return endsWithFlowBreak(last);
  }
  if (block.type === "decision_block") {
    return (
      block.choices.every(([_, c]) => endsWithFlowBreak(c)) &&
      (block.default == null || endsWithFlowBreak(block.default))
    );
  }
  return isBreakFlow(block);
}

type IntRef = { value: number };

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
  private usedScopeLabels = new Map<string, number>();

  private makeSeq(_blocks: CodeBlock[]): CodeBlock {
    const blocks = _blocks
      .flatMap(b => (b.type === "seq_block" ? b.blocks : b))
      .filter(b => b.type !== "empty_block");
    switch (blocks.length) {
      case 0:
        return empty;
      case 1:
        return blocks[0];
      default: {
        const firstBreakOrContinue = blocks.findIndex(endsWithFlowBreak);

        blocks.slice(firstBreakOrContinue + 1).forEach(b => {
          if (b.type === "break_block") this.unuseScopeBreaks(b.label, 1);
        });

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

  // The optimization removes "breaks" with this label if they are the last statement
  private removeBreaksOf(
    block: CodeBlock,
    label: Label,
    removed: IntRef
  ): CodeBlock {
    switch (block.type) {
      case "scope_block":
        return {
          type: "scope_block",
          label,
          block: this.removeBreaksOf(block.block, label, removed),
        };
      case "seq_block": {
        const { blocks } = block;
        const lastIdx = blocks.length - 1;
        const last = blocks[lastIdx];
        const optimizedLast = this.removeBreaksOf(last, label, removed);
        if (optimizedLast === last) return block; // Fast path
        return this.makeSeq([...blocks.slice(0, lastIdx), optimizedLast]);
      }
      case "decision_block":
        return {
          type: "decision_block",
          choices: block.choices.map(([edge, choice]) => [
            edge,
            this.removeBreaksOf(choice, label, removed),
          ]),
          default: block.default
            ? this.removeBreaksOf(block.default, label, removed)
            : null,
          node: block.node,
        };
      case "break_block":
        if (block.label === label) {
          removed.value++;
          return empty;
        }
        return block;
      case "continue_block":
      case "return_block":
      case "loop_block":
      case "expect_block":
      case "empty_block":
        return block;
      default:
        never(block);
    }
  }

  private createScopeBreak(label: string): BreakScopeBlock {
    const curr = this.usedScopeLabels.get(label) ?? 0;
    this.usedScopeLabels.set(label, curr + 1);
    return {
      type: "break_block",
      label,
    };
  }

  private unuseScopeBreaks(label: string, amount: number): number {
    const currAmount = this.usedScopeLabels.get(label) ?? 0;
    const newAmount = currAmount - amount;
    assertion(newAmount >= 0);
    this.usedScopeLabels.set(label, newAmount);
    return newAmount;
  }

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

  private surroundWithScope(label: Label, block: CodeBlock): CodeBlock {
    const removed = { value: 0 };
    const optimized = this.removeBreaksOf(block, label, removed);
    const usedLabels = this.unuseScopeBreaks(label, removed.value);
    if (optimized.type === "empty_block") {
      return empty;
    }
    if (usedLabels === 0) {
      return optimized;
    }
    return {
      type: "scope_block",
      label,
      block: optimized,
    };
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
          this.makeSeq([
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
            this.makeSeq([
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
            this.makeSeq([
              {
                type: "expect_block",
                edge: outEdge,
              },
              this.createScopeBreak(this.getScopeLabel(dest)),
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
        block: this.makeSeq([block, this.createScopeBreak(label)]),
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
      lastBlock = this.makeSeq([
        this.surroundWithScope(this.getScopeLabel(nodes), lastBlock),
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
