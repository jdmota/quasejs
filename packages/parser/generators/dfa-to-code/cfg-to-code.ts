import { never } from "../../../util/miscellaneous.ts";
import { CFGGroup, CFGNode, CFGEdge, type CFGNodeOrGroup } from "./cfg.ts";

export type CodeBlock<N, B, S, T, M> =
  | SimpleBlock<B>
  | SeqBlock<N, B, S, T, M>
  | DecisionBlock<N, B, S, T, M>
  | ScopeBlock<N, B, S, T, M>
  | LoopBlock<N, B, S, T, M>
  | ContinueBlock
  | BreakScopeBlock
  | EmptyBlock
  | DispatchBlock<N>;

type Label = string;

export type SimpleBlock<B> = Readonly<{
  type: "simple_block";
  block: B; // This is metadata, and cannot be other blocks
  return: boolean;
}>;

export type SeqBlock<N, B, S, T, M> = Readonly<{
  type: "seq_block";
  blocks: readonly CodeBlock<N, B, S, T, M>[];
}>;

export type DecisionBlock<N, B, S, T, M> = Readonly<{
  type: "decision_block";
  choices: readonly (readonly [T, CodeBlock<N, B, S, T, M>])[];
  state: S;
  metadata: M;
}>;

export type DispatchBlock<N> = Readonly<{
  type: "dispatch_block";
  node: N;
}>;

export type ScopeBlock<N, B, S, T, M> = Readonly<{
  type: "scope_block";
  label: Label;
  block: CodeBlock<N, B, S, T, M>;
}>;

export type LoopBlock<N, B, S, T, M> = Readonly<{
  type: "loop_block";
  label: Label;
  block: CodeBlock<N, B, S, T, M>;
}>;

export type ContinueBlock = Readonly<{
  type: "continue_block";
  label: Label;
}>;

export type BreakScopeBlock = Readonly<{
  type: "break_block";
  label: Label;
}>;

export type EmptyBlock = Readonly<{
  type: "empty_block";
}>;

const empty: EmptyBlock = {
  type: "empty_block",
};

export function endsWithFlowBreak<N, B, S, T, M>(
  block: CodeBlock<N, B, S, T, M>
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
  block: CodeBlock<N, B, S, T, M>,
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
      return false;
    case "dispatch_block":
      throw new Error("TODO");
    default:
      never(block);
  }
}

export abstract class CfgToCode<Code, Decision, N, B, S, T, M> {
  private readonly processed = new Set<CFGNodeOrGroup<Code, Decision>>();
  private readonly scopeLabels = new Map<CFGNode<Code, Decision>, number>();
  private readonly loopLabels = new Map<CFGNode<Code, Decision>, number>();
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
    _blocks: CodeBlock<N, B, S, T, M>[]
  ): CodeBlock<N, B, S, T, M> {
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
    block: CodeBlock<N, B, S, T, M>,
    label: Label
  ): CodeBlock<N, B, S, T, M> {
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
        return block;
      case "dispatch_block":
        throw new Error("TODO");
      default:
        never(block);
    }
  }

  // The optimization turns "breaks" of a scope to "breaks" of a loop
  private replaceBreaksInLoop(
    loopLabel: Label,
    block: CodeBlock<N, B, S, T, M>,
    label: Label
  ): CodeBlock<N, B, S, T, M> {
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
        return block;
      case "dispatch_block":
        throw new Error("TODO");
      default:
        never(block);
    }
  }

  private surroundWithScope(
    label: Label,
    block: CodeBlock<N, B, S, T, M>
  ): CodeBlock<N, B, S, T, M> {
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
    block: CodeBlock<N, B, S, T, M>
  ): CodeBlock<N, B, S, T, M> {
    if (block.type === "empty_block") {
      throw new Error(`Empty infinite loop?`);
    }
    return {
      type: "loop_block",
      label,
      block,
    };
  }

  protected createBreak(label: string): BreakScopeBlock {
    return {
      type: "break_block",
      label,
    };
  }

  protected getScopeLabel(nodes: CFGNodeOrGroup<Code, Decision>): string {
    let n = nodes;
    while (n instanceof CFGGroup) n = n.entry;

    const curr = this.scopeLabels.get(n);
    if (curr) return `s${curr}`;
    const label = this.scopeLabelUuid++;
    this.scopeLabels.set(n, label);
    return `s${label}`;
  }

  protected getLoopLabel(nodes: CFGNodeOrGroup<Code, Decision>): string {
    let n = nodes;
    while (n instanceof CFGGroup) n = n.entry;

    const curr = this.loopLabels.get(n);
    if (curr) return `l${curr}`;
    const label = this.loopLabelUuid++;
    this.loopLabels.set(n, label);
    return `l${label}`;
  }

  protected handleEdge(
    parent: CFGGroup<Code, Decision>,
    node: CFGNode<Code, Decision>,
    { dest, type }: CFGEdge<Code, Decision>
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
      const result: CodeBlock<N, B, S, T, M> = {
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
    node: CFGNode<Code, Decision>,
    parent: CFGGroup<Code, Decision>
  ): CodeBlock<N, B, S, T, M>;

  private handleLoop(
    group: CFGGroup<Code, Decision>
  ): CodeBlock<N, B, S, T, M> {
    return this.makeLoop(this.getLoopLabel(group), this.processGroup(group));
  }

  private handleNodes(
    nodes: CFGNodeOrGroup<Code, Decision>,
    parent: CFGGroup<Code, Decision>
  ) {
    this.processed.add(nodes);
    if (nodes instanceof CFGGroup) {
      return this.handleLoop(nodes);
    } else {
      return this.handleNode(nodes, parent);
    }
  }

  processGroup(ordered: CFGGroup<Code, Decision>) {
    let lastBlock: CodeBlock<N, B, S, T, M> = empty;
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
