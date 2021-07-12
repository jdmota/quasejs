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
import { Grammar } from "../grammar/grammar";
import {
  Declaration,
  ExprRule,
  RuleDeclaration,
} from "../grammar/grammar-builder";
import { FieldsAndArgs } from "../grammar/grammar-visitors";
import { assertion, never } from "../utils";
import { CodeBlock, endsWithFlowBreak } from "./dfa-to-code/cfg-to-code";
import { CFGEdge, CFGNode, DispatchTransition } from "./dfa-to-code/dfa-to-cfg";

function lines(arr: readonly (string | undefined)[], separator = "\n"): string {
  return arr.filter(Boolean).join(separator);
}

export class ParserGenerator {
  private readonly grammar: Grammar;
  private readonly analyzer: Analyzer;
  private readonly rule: Declaration;
  private readonly locals: FieldsAndArgs;
  private nodes: Map<CFGNode, number>;
  private nodeUuid: number;
  private internalVars: Set<string>;

  constructor(
    grammar: Grammar,
    analyzer: Analyzer,
    rule: Declaration,
    locals: FieldsAndArgs
  ) {
    this.grammar = grammar;
    this.analyzer = analyzer;
    this.rule = rule;
    this.locals = locals;
    this.nodes = new Map();
    this.nodeUuid = 1;
    this.internalVars = new Set();
  }

  private nodeId(node: CFGNode) {
    const curr = this.nodes.get(node);
    if (curr == null) {
      const id = this.nodeUuid++;
      this.nodes.set(node, id);
      return id;
    }
    return curr;
  }

  private markLocal(localVar: string) {
    this.internalVars.add(localVar);
    return localVar;
  }

  private renderConditions(set: ReadonlySet<RangeTransition>) {
    if (set.size === 0) {
      return "false";
    }
    return Array.from(set)
      .map(r => this.renderCondition(r))
      .join(" || ");
  }

  private renderCondition(r: RangeTransition) {
    const { from, to } = r;
    this.markLocal("$c");
    return from === to ? `$c === ${from}` : `${from} <= $c && $c <= ${to}`;
  }

  private renderCode(code: ExprRule): string {
    switch (code.type) {
      case "id":
        return code.id;
      case "select":
        return `${this.renderCode(code.parent)}.${code.field}`;
      case "int":
        return `${code.value}`;
      case "object":
        return `{${code.fields
          .map(([k, v]) => `${k}: ${this.renderCode(v)}`)
          .join(", ")}}`;
      case "call2":
        return `this.external.${code.id}(${code.args
          .map(e => this.renderCode(e))
          .join(", ")})`;
      default:
        never(code);
    }
  }

  private renderTransition(t: AnyTransition): string {
    if (t instanceof RangeTransition) {
      if (t.from === t.to) {
        return `this.expect(${t.from});`;
      }
      return `this.expect2(${t.from}, ${t.to});`;
    }
    if (t instanceof CallTransition) {
      const type = this.grammar.getRule(t.ruleName).decl.type;
      return `this.${type}${t.ruleName}(${t.args
        .map(a => this.renderCode(a))
        .join(", ")});`;
    }
    if (t instanceof FieldTransition) {
      return "TODO field;";
    }
    if (t instanceof ActionTransition) {
      return `${this.renderCode(t.code)};`;
    }
    if (t instanceof PredicateTransition) {
      return "TODO predicate;";
    }
    if (t instanceof ReturnTransition) {
      const { returnCode } = t;
      if (returnCode == null) {
        return `return {${Array.from(this.locals.fields).join(", ")}};`;
      }
      return `return ${this.renderCode(returnCode)};`;
    }
    if (t instanceof EpsilonTransition) {
      return "// EPSILON";
    }
    never(t);
  }

  private markTransitionAfterDispatch(indent: string, edge: CFGEdge) {
    return edge.originalDest
      ? `${indent}  ${this.markLocal(
          `$d${this.nodeId(edge.dest)}`
        )} = ${this.nodeId(edge.originalDest)};`
      : "";
  }

  private r(indent: string, block: CodeBlock): string {
    switch (block.type) {
      case "expect_block":
        return `${indent}${this.renderTransition(block.edge.transition)}`;
      case "seq_block":
        return lines(block.blocks.map(b => this.r(indent, b)));
      case "decision_block": {
        // If this corresponds to a dispatch node
        if (block.node.state == null) {
          return lines([
            `${indent}switch(${this.markLocal(
              `$d${this.nodeId(block.node)}`
            )}){`,
            ...block.choices.map(([t, d]) => {
              assertion(t.transition instanceof DispatchTransition);
              return (
                `${indent}  case ${this.nodeId(t.dest)}:\n` +
                this.r(`${indent}    `, d)
              );
            }),
            `${indent}}`,
          ]);
        }
        const decisions = this.analyzer.analyze(
          this.rule.name,
          block.node.state
        );
        const choices = decisions.invert();
        if (block.choices.length >= 2 && choices.compatibleWithSwitch) {
          return lines([
            `${indent}switch(this.current()){`,
            ...block.choices.map(([t, d]) => {
              const ranges = choices.map.get(t.transition);
              assertion(ranges.size === 1);
              const range = ranges.values().next().value as RangeTransition;
              assertion(range instanceof RangeTransition);
              assertion(range.from === range.to);
              return lines([
                `${indent}  case ${range.from}:`,
                this.r(`${indent}    `, d),
                this.markTransitionAfterDispatch(indent, t),
                endsWithFlowBreak(d) ? "" : `${indent}    break;`,
              ]);
            }),
            `${indent}  default:\n` +
              (block.default
                ? this.r(`${indent}    `, block.default)
                : `${indent}    this.unexpected();`) +
              `\n${indent}}`,
          ]);
        }
        return (
          `${indent}${this.markLocal("$c")} = this.current();\n${indent}` +
          lines(
            [
              ...block.choices.map(([t, d]) => {
                const ranges = choices.map.get(t.transition);
                return lines([
                  `if(${this.renderConditions(ranges)}){`,
                  this.r(`${indent}  `, d),
                  this.markTransitionAfterDispatch(indent, t),
                  `${indent}}`,
                ]);
              }),
              `{\n${
                block.default
                  ? this.r(`${indent}  `, block.default)
                  : `${indent}  this.unexpected();`
              }\n${indent}}`,
            ],
            " else "
          )
        );
      }
      case "scope_block":
        return lines([
          `${indent}${block.label}:do{`,
          this.r(indent + "  ", block.block),
          `${indent}}while(0);`,
        ]);
      case "loop_block":
        return lines([
          `${indent}${block.label}:while(1){`,
          this.r(indent + "  ", block.block),
          `${indent}}`,
        ]);
      case "break_block":
        return `${indent}break ${block.label};`;
      case "continue_block":
        return `${indent}continue ${block.label};`;
      case "return_block":
        // There is always a ReturnTransition before, no need to render the "return" block
        return "";
      case "empty_block":
        return "";
      default:
        never(block);
    }
  }

  process(block: CodeBlock) {
    const rendered = this.r("  ", block);
    const args = this.rule.type === "rule" ? this.rule.args.join(",") : "";
    const vars = [
      ...Array.from(this.internalVars).map(v => `${v}=-2`),
      ...Array.from(this.locals.fields).map(f => `${f}=null`),
    ];
    const decls = vars.length > 0 ? `\n  let ${vars.join(", ")};` : "";
    return `${this.rule.type}${this.rule.name}(${args}) {${decls}\n${rendered}\n}`;
  }
}
