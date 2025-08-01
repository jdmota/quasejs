import { never } from "../miscellaneous.ts";
import {
  BaseCFGGroup,
  BaseCFGNode,
  BaseCFGEdge,
  type BaseCFGNodeOrGroup,
} from "./cfg.ts";

// N: node type
// B: simple block data
// S: decision block state
// T: decision block transition
// M: decision block metadata
export type BaseCodeBlock<N, B, S, T, M> =
  | BaseSimpleBlock<B>
  | BaseSeqBlock<N, B, S, T, M>
  | BaseDecisionBlock<N, B, S, T, M>
  | BaseScopeBlock<N, B, S, T, M>
  | BaseLoopBlock<N, B, S, T, M>
  | BaseContinueBlock
  | BaseBreakScopeBlock
  | BaseEmptyBlock
  | BaseDispatchBlock<N, B, S, T, M>;

type Label = string;

export type BaseSimpleBlock<B> = Readonly<{
  type: "simple_block";
  block: B; // This is metadata, and cannot be other blocks
  return: boolean;
}>;

export type BaseSeqBlock<N, B, S, T, M> = Readonly<{
  type: "seq_block";
  blocks: readonly BaseCodeBlock<N, B, S, T, M>[];
}>;

export type BaseDecisionBlock<N, B, S, T, M> = Readonly<{
  type: "decision_block";
  choices: readonly (readonly [T, BaseCodeBlock<N, B, S, T, M>])[];
  state: S;
  metadata: M;
}>;

export type BaseDispatchBlock<N, B, S, T, M> = Readonly<{
  type: "dispatch_block";
  node: N;
  choices: readonly BaseCodeBlock<N, B, S, T, M>[];
}>;

export type BaseScopeBlock<N, B, S, T, M> = Readonly<{
  type: "scope_block";
  label: Label;
  block: BaseCodeBlock<N, B, S, T, M>;
}>;

export type BaseLoopBlock<N, B, S, T, M> = Readonly<{
  type: "loop_block";
  label: Label;
  block: BaseCodeBlock<N, B, S, T, M>;
}>;

export type BaseContinueBlock = Readonly<{
  type: "continue_block";
  label: Label;
}>;

export type BaseBreakScopeBlock = Readonly<{
  type: "break_block";
  label: Label;
}>;

export type BaseEmptyBlock = Readonly<{
  type: "empty_block";
}>;

const empty: BaseEmptyBlock = {
  type: "empty_block",
};

export function endsWithFlowBreak<N, B, S, T, M>(
  block: BaseCodeBlock<N, B, S, T, M>
): boolean {
  if (block.type === "seq_block") {
    const { blocks } = block;
    const last = blocks[blocks.length - 1];
    return endsWithFlowBreak(last);
  }
  if (block.type === "decision_block") {
    return block.choices.every(([_, c]) => endsWithFlowBreak(c));
  }
  return (
    block.type === "break_block" ||
    block.type === "continue_block" ||
    (block.type === "simple_block" && block.return)
  );
}

function usesLabel<N, B, S, T, M>(
  block: BaseCodeBlock<N, B, S, T, M>,
  label: string
): boolean {
  switch (block.type) {
    case "scope_block":
    case "loop_block":
      return usesLabel(block.block, label);
    case "seq_block":
      return block.blocks.some(b => usesLabel(b, label));
    case "decision_block":
      return block.choices.some(([_, b]) => usesLabel(b, label));
    case "break_block":
    case "continue_block":
      return block.label === label;
    case "simple_block":
    case "empty_block":
    case "dispatch_block":
      return false;
    default:
      never(block);
  }
}

export abstract class BaseCfgToCode<Code, Decision, N, B, S, T, M> {
  private readonly processed = new Set<BaseCFGNodeOrGroup<Code, Decision>>();
  private readonly scopeLabels = new Map<BaseCFGNode<Code, Decision>, number>();
  private readonly loopLabels = new Map<BaseCFGNode<Code, Decision>, number>();
  private scopeLabelUuid = 1;
  private loopLabelUuid = 1;

  reset() {
    this.processed.clear();
    this.scopeLabels.clear();
    this.loopLabels.clear();
    this.scopeLabelUuid = 1;
    this.loopLabelUuid = 1;
  }

  protected makeSeq(
    _blocks: BaseCodeBlock<N, B, S, T, M>[]
  ): BaseCodeBlock<N, B, S, T, M> {
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
        return this.optimizeSeq({
          type: "seq_block",
          blocks:
            firstBreakOrContinue === -1
              ? blocks
              : blocks.slice(0, firstBreakOrContinue + 1),
        });
      }
    }
  }

  private optimizeSeq(
    block: BaseSeqBlock<N, B, S, T, M>
  ): BaseCodeBlock<N, B, S, T, M> {
    const first = block.blocks[0];
    if (first.type === "decision_block") {
      // If all branches except one end flow, we can move whatever code comes next
      // inside that unique branch
      const indicesThatDoNotEnd = first.choices
        .map(([_, c], idx) => {
          return endsWithFlowBreak(c) ? -1 : idx;
        })
        .filter(i => i >= 0);
      if (indicesThatDoNotEnd.length === 1) {
        const idx = indicesThatDoNotEnd[0];
        return {
          ...first,
          choices: first.choices.map((c, i) => {
            if (i === idx) {
              return [
                c[0],
                this.makeSeq([c[1], ...block.blocks.slice(1)]),
              ] as const;
            }
            return c;
          }),
        };
      }
    }
    return block;
  }

  // The optimization removes "breaks" with this label if they are the last statement
  private removeBreaksOf(
    block: BaseCodeBlock<N, B, S, T, M>,
    label: Label
  ): BaseCodeBlock<N, B, S, T, M> {
    switch (block.type) {
      case "scope_block":
        return {
          type: "scope_block",
          label,
          block: this.removeBreaksOf(block.block, label),
        };
      case "seq_block": {
        const { blocks } = block;
        const lastIdx = blocks.length - 1;
        const last = blocks[lastIdx];
        const optimizedLast = this.removeBreaksOf(last, label);
        if (optimizedLast === last) return block; // Fast path
        return this.makeSeq([...blocks.slice(0, lastIdx), optimizedLast]);
      }
      case "decision_block":
        return {
          type: "decision_block",
          choices: block.choices.map(([edge, choice]) => [
            edge,
            this.removeBreaksOf(choice, label),
          ]),
          state: block.state,
          metadata: block.metadata,
        };
      case "loop_block":
        return {
          type: "loop_block",
          label: block.label,
          block: this.replaceBreaksInLoop(block.label, block.block, label),
        };
      case "break_block":
        return block.label === label ? empty : block;
      case "continue_block":
      case "simple_block":
      case "empty_block":
      case "dispatch_block":
        return block;
      default:
        never(block);
    }
  }

  // The optimization turns "breaks" of a scope to "breaks" of a loop
  private replaceBreaksInLoop(
    loopLabel: Label,
    block: BaseCodeBlock<N, B, S, T, M>,
    label: Label
  ): BaseCodeBlock<N, B, S, T, M> {
    switch (block.type) {
      case "scope_block":
        return {
          type: "scope_block",
          label,
          block: this.replaceBreaksInLoop(loopLabel, block.block, label),
        };
      case "seq_block":
        return this.makeSeq(
          block.blocks.map(b => this.replaceBreaksInLoop(loopLabel, b, label))
        );
      case "decision_block":
        return {
          type: "decision_block",
          choices: block.choices.map(([edge, choice]) => [
            edge,
            this.replaceBreaksInLoop(loopLabel, choice, label),
          ]),
          state: block.state,
          metadata: block.metadata,
        };
      case "loop_block":
        return {
          type: "loop_block",
          label: block.label,
          block: this.replaceBreaksInLoop(loopLabel, block.block, label),
        };
      case "break_block":
        return block.label === label ? this.createBreak(loopLabel) : block;
      case "continue_block":
      case "simple_block":
      case "empty_block":
      case "dispatch_block":
        return block;
      default:
        never(block);
    }
  }

  private surroundWithScope(
    label: Label,
    block: BaseCodeBlock<N, B, S, T, M>
  ): BaseCodeBlock<N, B, S, T, M> {
    const optimized = this.removeBreaksOf(block, label);
    if (optimized.type === "seq_block") {
      const { blocks } = optimized;
      const idx = blocks.findIndex(b => usesLabel(b, label));
      if (idx === -1) {
        return optimized;
      }
      return this.makeSeq([
        ...blocks.slice(0, idx),
        {
          type: "scope_block",
          label,
          block: this.makeSeq(blocks.slice(idx)),
        },
      ]);
    }
    if (usesLabel(optimized, label)) {
      return {
        type: "scope_block",
        label,
        block: optimized,
      };
    }
    return optimized;
  }

  protected makeLoop(
    label: Label,
    block: BaseCodeBlock<N, B, S, T, M>
  ): BaseCodeBlock<N, B, S, T, M> {
    if (block.type === "empty_block") {
      throw new Error(`Empty infinite loop?`);
    }
    return {
      type: "loop_block",
      label,
      block,
    };
  }

  protected createBreak(label: string): BaseBreakScopeBlock {
    return {
      type: "break_block",
      label,
    };
  }

  protected getScopeLabel(nodes: BaseCFGNodeOrGroup<Code, Decision>): string {
    let n = nodes;
    while (n instanceof BaseCFGGroup) n = n.entry;

    const curr = this.scopeLabels.get(n);
    if (curr) return `s${curr}`;
    const label = this.scopeLabelUuid++;
    this.scopeLabels.set(n, label);
    return `s${label}`;
  }

  protected getLoopLabel(nodes: BaseCFGNodeOrGroup<Code, Decision>): string {
    let n = nodes;
    while (n instanceof BaseCFGGroup) n = n.entry;

    const curr = this.loopLabels.get(n);
    if (curr) return `l${curr}`;
    const label = this.loopLabelUuid++;
    this.loopLabels.set(n, label);
    return `l${label}`;
  }

  protected handleEdge(
    parent: BaseCFGGroup<Code, Decision>,
    node: BaseCFGNode<Code, Decision>,
    { dest, type }: BaseCFGEdge<Code, Decision>
  ) {
    if (type === "forward") {
      const destGroup = parent.find(dest);
      if (destGroup.forwardPredecessors() === 1) {
        // Nest the code
        return {
          loop: false,
          result: this.handleNodes(destGroup, parent),
        };
      } else {
        return {
          loop: false,
          result: this.createBreak(this.getScopeLabel(dest)),
        };
      }
    } else {
      const result: BaseCodeBlock<N, B, S, T, M> = {
        type: "continue_block",
        label: this.getLoopLabel(dest),
      };
      return {
        loop: node === dest,
        result,
      };
    }
  }

  abstract handleNode(
    node: BaseCFGNode<Code, Decision>,
    parent: BaseCFGGroup<Code, Decision>
  ): BaseCodeBlock<N, B, S, T, M>;

  private handleLoop(
    group: BaseCFGGroup<Code, Decision>
  ): BaseCodeBlock<N, B, S, T, M> {
    return this.makeLoop(this.getLoopLabel(group), this.processGroup(group));
  }

  private handleNodes(
    nodes: BaseCFGNodeOrGroup<Code, Decision>,
    parent: BaseCFGGroup<Code, Decision>
  ) {
    this.processed.add(nodes);
    if (nodes instanceof BaseCFGGroup) {
      return this.handleLoop(nodes);
    } else {
      return this.handleNode(nodes, parent);
    }
  }

  processGroup(ordered: BaseCFGGroup<Code, Decision>) {
    let lastBlock: BaseCodeBlock<N, B, S, T, M> = empty;
    for (const nodes of ordered.contents) {
      if (this.processed.has(nodes)) continue;
      lastBlock = this.makeSeq([
        this.surroundWithScope(this.getScopeLabel(nodes), lastBlock),
        this.handleNodes(nodes, ordered),
      ]);
    }
    return lastBlock;
  }
}
