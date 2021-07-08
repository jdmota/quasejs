import { Analyzer } from "../analysis/analysis";
import {
  ActionTransition,
  AnyTransition,
  CallTransition,
  EpsilonTransition,
  FieldTransition,
  PredicateTransition,
  RangeTransition,
  ReturnTransition,
} from "../automaton/transitions";
import {
  Declaration,
  ExprRule,
  RuleDeclaration,
} from "../grammar/grammar-builder";
import { assertion, never } from "../utils";
import { CodeBlock, removeBreaksWithoutLabel } from "./dfa-to-code/cfg-to-code";

export class ParserGenerator {
  readonly analyzer: Analyzer;

  constructor(analyzer: Analyzer) {
    this.analyzer = analyzer;
  }

  private renderCondition(t: RangeTransition) {
    const { from, to } = t;
    if (from === to) {
      return `$c === ${from}`;
    }
    return `${from} <= $c && $c <= ${to}`;
  }

  private renderCode(code: ExprRule) {
    return "TODO code";
  }

  private renderTransition(t: AnyTransition): string {
    if (t instanceof RangeTransition) {
      if (t.from === t.to) {
        return `this.expect(${t.from})`;
      }
      return `this.expect2(${t.from}, ${t.to})`;
    }
    if (t instanceof CallTransition) {
      return `this.rule${t.ruleName}(${t.args
        .map(a => this.renderCode(a))
        .join(", ")})`;
    }
    if (t instanceof FieldTransition) {
      return "TODO field";
    }
    if (t instanceof ActionTransition) {
      return this.renderCode(t.code);
    }
    if (t instanceof PredicateTransition) {
      return "TODO predicate";
    }
    if (t instanceof ReturnTransition) {
      const { returnCode } = t;
      if (returnCode == null) {
        return `return TODO`;
      }
      return `return ${this.renderCode(returnCode)}`;
    }
    if (t instanceof EpsilonTransition) {
      return "";
    }
    never(t);
  }

  private render(indent: string, block: CodeBlock): string {
    switch (block.type) {
      case "expect_block":
        return `${indent}${this.renderTransition(block.edge.transition)};`;
      case "seq_block":
        return block.blocks.map(b => this.render(indent, b)).join("\n");
      case "decision_block": {
        const hasDefault = block.choices.some(([t]) => t == null);
        // TODO we actually dont need the name of the rule?
        const decisions = this.analyzer.analyze("", block.node.state!!);
        const choices = decisions.invert();
        if (decisions.hasOnlyUnitRanges()) {
          return [
            `${indent}switch(this.current()){`,
            ...block.choices.map(([t, d]) => {
              if (t == null) {
                return `${indent}  default:\n${this.render(
                  `${indent}    `,
                  d
                )}`;
              } else {
                const range = choices.get(t.transition);
                if (range) {
                  assertion(range.from === range.to);
                  return `${indent}  case ${range.from}:\n${this.render(
                    `${indent}    `,
                    d
                  )}`;
                }
                return "";
              }
            }),
            hasDefault
              ? `${indent}}`
              : `${indent}  default:\n${indent}    this.unexpected();\n${indent}}`,
          ]
            .filter(Boolean)
            .join("\n");
        }
        return (
          `${indent}$c = this.current();\n${indent}` +
          [
            ...block.choices.map(([t, d]) => {
              if (t == null) {
                return [
                  `{`,
                  `${this.render(`${indent}  `, removeBreaksWithoutLabel(d))}`,
                  `${indent}}`,
                ].join("\n");
              } else {
                const range = choices.get(t.transition);
                if (range) {
                  return [
                    `if(${this.renderCondition(range)}){`,
                    `${this.render(
                      `${indent}  `,
                      removeBreaksWithoutLabel(d)
                    )}`,
                    `${indent}}`,
                  ].join("\n");
                }
                return "";
              }
            }),
            hasDefault ? `` : `{\n${indent}  this.unexpected();\n${indent}}`,
          ]
            .filter(Boolean)
            .join(" else ")
        );
      }
      case "scope_block":
        return [
          `${indent}l${block.label}:do{`,
          this.render(indent + "  ", block.block),
          `${indent}}while(0);`,
        ].join("\n");
      case "loop_block":
        return [
          `${indent}l${block.label}:while(1){`,
          this.render(indent + "  ", block.block),
          `${indent}}`,
        ].join("\n");
      case "break_case_block":
        return `${indent}break;`;
      case "break_block":
        return `${indent}break l${block.label};`;
      case "continue_block":
        return `${indent}continue l${block.label};`;
      case "return_block":
        return `${indent}return;`;
      case "empty_block":
        return "";
      default:
        never(block);
    }
  }

  process(block: CodeBlock) {
    return `let $c = -2;\n${this.render("", block)}`;
  }
}
