import { AbstractDFAState } from "../../automaton/state.ts";
import { DFA } from "../../optimizer/abstract-optimizer.ts";
import { ObjectHashEquals, first, never, nonNull } from "../../utils/index.ts";
import { cfgToGroups, CFGGroup } from "./cfg.ts";
import {
  ParserCFGEdge,
  ParserCFGGroup,
  ParserCFGNode,
  ParserCFGNodeOrGroup,
  RegularBlock,
  convertDFAtoCFG,
} from "./dfa-to-cfg.ts";

export type CodeBlock<S, T> =
  | ExpectBlock<T>
  | SeqBlock<S, T>
  | DecisionBlock<S, T>
  | ScopeBlock<S, T>
  | LoopBlock<S, T>
  | ReturnBlock<T>
  | ContinueBlock
  | BreakScopeBlock
  | EmptyBlock
  | DispatchBlock<S, T>;

type Label = string;

export type ExpectBlock<T> = Readonly<{
  type: "expect_block";
  transition: T;
}>;

export type SeqBlock<S, T> = Readonly<{
  type: "seq_block";
  blocks: readonly CodeBlock<S, T>[];
}>;

export type DecisionBlock<S, T> = Readonly<{
  type: "decision_block";
  choices: readonly (readonly [T, CodeBlock<S, T>])[];
  state: S;
}>;

export type DispatchBlock<S, T> = Readonly<{
  type: "dispatch_block";
  node: ParserCFGNode<S, T>;
}>;

export type ScopeBlock<S, T> = Readonly<{
  type: "scope_block";
  label: Label;
  block: CodeBlock<S, T>;
}>;

export type LoopBlock<S, T> = Readonly<{
  type: "loop_block";
  label: Label;
  block: CodeBlock<S, T>;
}>;

export type ContinueBlock = Readonly<{
  type: "continue_block";
  label: Label;
}>;

export type BreakScopeBlock = Readonly<{
  type: "break_block";
  label: Label;
}>;

export type ReturnBlock<T> = Readonly<{
  type: "return_block";
  transition: T;
}>;

export type EmptyBlock = Readonly<{
  type: "empty_block";
}>;

const empty: EmptyBlock = {
  type: "empty_block",
};

export function endsWithFlowBreak<S, T>(block: CodeBlock<S, T>): boolean {
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
    block.type === "return_block"
  );
}

function usesLabel<S, T>(block: CodeBlock<S, T>, label: string): boolean {
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
    case "expect_block":
    case "return_block":
    case "empty_block":
      return false;
    case "dispatch_block":
      throw new Error("TODO");
    default:
      never(block);
  }
}

export class CfgToCode<
  S extends AbstractDFAState<S, T>,
  T extends ObjectHashEquals,
> {
  private readonly processed = new Set<ParserCFGNodeOrGroup<S, T>>();
  private readonly scopeLabels = new Map<ParserCFGNode<S, T>, number>();
  private readonly loopLabels = new Map<ParserCFGNode<S, T>, number>();
  private scopeLabelUuid = 1;
  private loopLabelUuid = 1;

  private makeSeq(_blocks: CodeBlock<S, T>[]): CodeBlock<S, T> {
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
    block: CodeBlock<S, T>,
    label: Label
  ): CodeBlock<S, T> {
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
      case "expect_block":
      case "return_block":
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
    block: CodeBlock<S, T>,
    label: Label
  ): CodeBlock<S, T> {
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
      case "expect_block":
      case "return_block":
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
    block: CodeBlock<S, T>
  ): CodeBlock<S, T> {
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

  private makeLoop(label: Label, block: CodeBlock<S, T>): CodeBlock<S, T> {
    if (block.type === "empty_block") {
      throw new Error(`Empty infinite loop?`);
    }
    return {
      type: "loop_block",
      label,
      block,
    };
  }

  private createBreak(label: string): BreakScopeBlock {
    return {
      type: "break_block",
      label,
    };
  }

  private getScopeLabel(nodes: ParserCFGNodeOrGroup<S, T>): string {
    let n = nodes;
    while (n instanceof CFGGroup) n = n.entry;

    const curr = this.scopeLabels.get(n);
    if (curr) return `s${curr}`;
    const label = this.scopeLabelUuid++;
    this.scopeLabels.set(n, label);
    return `s${label}`;
  }

  private getLoopLabel(nodes: ParserCFGNodeOrGroup<S, T>): string {
    let n = nodes;
    while (n instanceof CFGGroup) n = n.entry;

    const curr = this.loopLabels.get(n);
    if (curr) return `l${curr}`;
    const label = this.loopLabelUuid++;
    this.loopLabels.set(n, label);
    return `l${label}`;
  }

  private handleEdge(
    parent: ParserCFGGroup<S, T>,
    node: ParserCFGNode<S, T>,
    { dest, type }: ParserCFGEdge<S, T>
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
      const result: CodeBlock<S, T> = {
        type: "continue_block",
        label: this.getLoopLabel(dest),
      };
      return {
        loop: node === dest,
        result,
      };
    }
  }

  // Return the next field assignment if the same
  private following(
    node: ParserCFGNode<S, T>,
    ref: { stop: boolean; state: T },
    fn: (
      node: ParserCFGNode<S, T>,
      block: RegularBlock<S, T>,
      ref: { stop: boolean; state: T }
    ) => void,
    seen = new Set()
  ) {
    const size = seen.size;
    seen.add(node);
    if (size !== seen.size) {
      for (const { dest } of node.outEdges) {
        if (ref.stop) {
          break;
        }
        if (dest.code?.type === "regular_block") {
          fn(dest, dest.code, ref);
        } else {
          this.following(dest, ref, fn, seen);
        }
      }
    }
    return ref.state;
  }

  private handleNode(
    node: ParserCFGNode<S, T>,
    parent: ParserCFGGroup<S, T>
  ): CodeBlock<S, T> {
    const { code } = node;
    let block: CodeBlock<S, T>;
    let isLoop = false;

    switch (code?.type) {
      case "regular_block": {
        const edge = first(node.outEdges);
        const { loop, result } = this.handleEdge(parent, node, edge);
        block = this.makeSeq([
          code.final
            ? { type: "return_block", transition: code.expr }
            : {
                type: "expect_block",
                transition: code.expr,
              },
          result,
        ]);
        isLoop = loop;
        break;
      }
      case "conditional_block": {
        const choices = [];
        for (const edge of node.outEdges) {
          const { loop, result } = this.handleEdge(parent, node, edge);
          isLoop ||= loop;
          choices.push([nonNull(edge.decision), result] as const);
        }
        block = {
          type: "decision_block",
          choices,
          state: code.state,
        };
        break;
      }
      case undefined:
        block = {
          type: "dispatch_block",
          node,
        };
        throw new Error("TODO");
        break;
      default:
        never(code);
    }

    if (isLoop) {
      const label = this.getLoopLabel(node);
      block = this.makeLoop(
        label,
        this.makeSeq([block, this.createBreak(label)])
      );
    }

    return block;
  }

  private handleLoop(group: ParserCFGGroup<S, T>): CodeBlock<S, T> {
    return this.makeLoop(this.getLoopLabel(group), this.processGroup(group));
  }

  private handleNodes(
    nodes: ParserCFGNodeOrGroup<S, T>,
    parent: ParserCFGGroup<S, T>
  ) {
    this.processed.add(nodes);
    if (nodes instanceof CFGGroup) {
      return this.handleLoop(nodes);
    } else {
      return this.handleNode(nodes, parent);
    }
  }

  private processGroup(ordered: ParserCFGGroup<S, T>) {
    let lastBlock: CodeBlock<S, T> = empty;
    for (const nodes of ordered.contents) {
      if (this.processed.has(nodes)) continue;
      lastBlock = this.makeSeq([
        this.surroundWithScope(this.getScopeLabel(nodes), lastBlock),
        this.handleNodes(nodes, ordered),
      ]);
    }
    return lastBlock;
  }

  process(dfa: DFA<S>) {
    const { start, nodes } = convertDFAtoCFG<S, T>(dfa);
    const ordered = cfgToGroups(start, nodes);
    return this.processGroup(ordered);
  }
}
