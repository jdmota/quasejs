import { assertion, first, never, nonNull } from "../../util/miscellaneous";
import { type DecisionExpr } from "../analysis/decision-expr";
import { DState } from "../automaton/state";
import { type AnyTransition } from "../automaton/transitions";
import { cfgToGroups } from "./dfa-to-code/cfg";
import { CfgToCode, type CodeBlock } from "./dfa-to-code/cfg-to-code";
import {
  type AmbiguityBlock,
  type CFGNodeCode,
  type ParserCFGGroup,
  type ParserCFGNode,
} from "./parser-dfa-to-cfg";

export type ParserDecisionMetadata = Readonly<{
  decisionOn: "ll" | "ff";
  decisionIdx: number;
}>;

export type ParserSimpleBlock =
  | Readonly<{
      type: "expect_block";
      transition: AnyTransition;
      dest: DState;
    }>
  | AmbiguityBlock;

export type ParserCodeBlock = CodeBlock<
  ParserCFGNode,
  ParserSimpleBlock,
  DState,
  DecisionExpr,
  ParserDecisionMetadata
>;

export class ParserCfgToCode extends CfgToCode<
  CFGNodeCode,
  DecisionExpr,
  ParserCFGNode,
  ParserSimpleBlock,
  DState,
  DecisionExpr,
  ParserDecisionMetadata
> {
  constructor() {
    super();
  }

  override handleNode(
    node: ParserCFGNode,
    parent: ParserCFGGroup
  ): ParserCodeBlock {
    const { code } = node;
    let block: ParserCodeBlock;
    let isLoop = false;

    switch (code?.type) {
      case "regular_block": {
        const simpleBlock: ParserCodeBlock = {
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

  // Based on https://medium.com/leaningtech/solving-the-structured-control-flow-problem-once-and-for-all-5123117b1ee2
  process(start: ParserCFGNode, nodes: ReadonlySet<ParserCFGNode>) {
    const ordered = cfgToGroups(start, nodes);
    return this.processGroup(ordered);
  }
}
