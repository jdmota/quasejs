import { DState } from "../../automaton/state";
import { AnyTransition } from "../../automaton/transitions";
import { DFA } from "../../optimizer/abstract-optimizer";
import { CFGGroup, CFGNode, CFGNodeOrGroup, DFAtoCFG } from "./dfa-to-cfg";

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

export type ExpectBlock = Readonly<{
  type: "expect_block";
  transition: AnyTransition;
}>;

export type SeqBlock = Readonly<{
  type: "seq_block";
  blocks: CodeBlock[];
}>;

export type DecisionBlock = Readonly<{
  type: "decision_block";
  choices: [AnyTransition | null, CodeBlock][];
}>;

export type ScopeBlock = Readonly<{
  type: "scope_block";
  label: string;
  block: CodeBlock;
}>;

export type LoopBlock = Readonly<{
  type: "loop_block";
  label: string;
  block: CodeBlock;
}>;

export type ContinueBlock = Readonly<{
  type: "continue_block";
  label: string;
}>;

export type BreakScopeBlock = Readonly<{
  type: "break_scope_block";
  label: string;
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
    type === "break_scope_block" ||
    type === "break_case_block" ||
    type === "continue_block" ||
    type === "return_block"
  );
}

function removeLastBlock(
  block: CodeBlock,
  fn: (b: CodeBlock) => boolean
): CodeBlock {
  if (block.type === "seq_block") {
    const { blocks } = block;
    const lastIdx = blocks.length - 1;
    const last = blocks[lastIdx];
    if (fn(last)) {
      return makeSeq(blocks.slice(0, lastIdx));
    }
    return block;
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

function makeScope(label: string, _block: CodeBlock): CodeBlock {
  const block = removeLastBlock(
    _block,
    b => b.type === "break_scope_block" && b.label === label
  );
  if (block.type === "empty_block") {
    return empty;
  }
  return {
    type: "scope_block",
    label,
    block,
  };
}

function makeLoop(label: string, block: CodeBlock): CodeBlock {
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
  private readonly scopeLabels = new Map<CFGNode, string>();
  private readonly loopLabels = new Map<CFGNode, string>();
  private scopeLabelUuid = 1;
  private loopLabelUuid = 1;

  private getScopeLabel(nodes: CFGNodeOrGroup) {
    let n = nodes;
    while (n instanceof CFGGroup) n = n.entry;

    const curr = this.scopeLabels.get(n);
    if (curr) return curr;
    const label = `s${this.scopeLabelUuid++}`;
    this.scopeLabels.set(n, label);
    return label;
  }

  private getLoopLabel(nodes: CFGNodeOrGroup) {
    let n = nodes;
    while (n instanceof CFGGroup) n = n.entry;

    const curr = this.loopLabels.get(n);
    if (curr) return curr;
    const label = `l${this.loopLabelUuid++}`;
    this.loopLabels.set(n, label);
    return label;
  }

  // TODO optimize diamonds to reduce the number of necessary scopes
  private handleNode(node: CFGNode, parent: CFGGroup): CodeBlock {
    const isFinal = node.end;
    const choices: [AnyTransition | null, CodeBlock][] = [];
    let isLoop = false;

    for (const { transition, dest, type } of node.outEdges) {
      if (type === "back") {
        if (node === dest) {
          isLoop = true;
        }
        choices.push([
          transition,
          makeSeq([
            {
              type: "expect_block",
              transition,
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
            transition,
            makeSeq([
              {
                type: "expect_block",
                transition,
              },
              this.handleNodes(destGroup, parent),
            ]),
          ]);
        } else {
          choices.push([
            transition,
            makeSeq([
              {
                type: "expect_block",
                transition,
              },
              {
                type: "break_scope_block",
                label: this.getScopeLabel(dest),
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
            type: "break_scope_block",
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
