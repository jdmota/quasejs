import { assertion, first, never, nonNull } from "../../util/miscellaneous";
import { type DecisionExpr } from "../analysis/decision-expr";
import { DState } from "../automaton/state";
import { type AnyTransition } from "../automaton/transitions";
import { cfgToGroups } from "../../util/cfg-and-code/cfg";
import {
  BaseCfgToCode,
  type BaseCodeBlock,
} from "../../util/cfg-and-code/base-cfg-to-code";
import {
  type AmbiguityBlock,
  type CFGNodeCode,
  type GrammarCFGGroup,
  type GrammarCFGNode,
} from "./dfa-to-cfg";

export type GrammarDecisionMetadata = Readonly<{
  decisionOn: "ll" | "ff";
  decisionIdx: number;
}>;

export type GrammarSimpleBlockData =
  | Readonly<{
      type: "expect_block";
      transition: AnyTransition;
      dest: DState;
    }>
  | AmbiguityBlock;

export type GrammarCodeBlock = BaseCodeBlock<
  GrammarCFGNode,
  GrammarSimpleBlockData,
  DState,
  DecisionExpr,
  GrammarDecisionMetadata
>;

export class CfgToCode extends BaseCfgToCode<
  CFGNodeCode,
  DecisionExpr,
  GrammarCFGNode,
  GrammarSimpleBlockData,
  DState,
  DecisionExpr,
  GrammarDecisionMetadata
> {
  constructor() {
    super();
  }

  override handleNode(
    node: GrammarCFGNode,
    parent: GrammarCFGGroup
  ): GrammarCodeBlock {
    const { code } = node;
    let block: GrammarCodeBlock;
    let isLoop = false;

    switch (code?.type) {
      case "regular_block": {
        const simpleBlock: GrammarCodeBlock = {
          type: "simple_block",
          block: {
            type: "expect_block",
            transition: code.transition,
            dest: code.dest,
          },
          return: node.outEdges.size === 0,
        };
        if (node.outEdges.size === 1) {
          const edge = first(node.outEdges);
          const { loop, result } = this.handleEdge(parent, node, edge);
          block = this.makeSeq([simpleBlock, result]);
          isLoop = loop;
        } else {
          assertion(node.outEdges.size === 0);
          block = simpleBlock;
          isLoop = false;
        }
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
          metadata: {
            decisionOn: code.decisionOn,
            decisionIdx: code.decisionIdx,
          },
        };
        break;
      }
      case "ambiguity_block": {
        block = {
          type: "simple_block",
          block: code,
          return: true,
        };
        break;
      }
      case undefined:
        throw new Error("TODO do not support dispatch block yet");
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

  // Based on https://medium.com/leaningtech/solving-the-structured-control-flow-problem-once-and-for-all-5123117b1ee2
  process(start: GrammarCFGNode, nodes: ReadonlySet<GrammarCFGNode>) {
    const ordered = cfgToGroups(start, nodes);
    return this.processGroup(ordered);
  }
}
