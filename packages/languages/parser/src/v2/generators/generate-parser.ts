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
import { Declaration, ExprRule } from "../grammar/grammar-builder";
import { any, assertion, find, never } from "../utils";
import {
  CodeBlock,
  endsWithFlowBreak,
  ExpectBlock,
} from "./dfa-to-code/cfg-to-code";
import { CFGEdge, CFGNode, DispatchTransition } from "./dfa-to-code/dfa-to-cfg";

function lines(arr: readonly (string | undefined)[], separator = "\n"): string {
  return arr.filter(Boolean).join(separator);
}

export class ParserGenerator {
  private readonly grammar: Grammar;
  private readonly analyzer: Analyzer;
  private readonly rule: Declaration;
  private nodes: Map<CFGNode, number>;
  private nodeUuid: number;
  private internalVars: Set<string>;

  constructor(grammar: Grammar, analyzer: Analyzer, rule: Declaration) {
    this.grammar = grammar;
    this.analyzer = analyzer;
    this.rule = rule;
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
        return code.fields.length === 0
          ? "EMPTY_OBJ"
          : `{${code.fields
              .map(([k, v]) =>
                v.type === "id" && v.id === k
                  ? k
                  : `${k}: ${this.renderCode(v)}`
              )
              .join(", ")}}`;
      case "call2":
        return `this.external.${code.id}(${code.args
          .map(e => this.renderCode(e))
          .join(", ")})`;
      default:
        never(code);
    }
  }

  private renderField(t: FieldTransition, what: string) {
    return t.multiple
      ? `(${t.name} = ${t.name} || []).push(${what})`
      : `${t.name} = ${what}`;
  }

  // This method detects if we need to same a value for later assignment
  // And optimizes code such as "$val = 2; field = $val;" to "field = 2;"
  private renderExpectBlock(indent: string, block: ExpectBlock): string {
    const t = block.edge.transition;
    if (t instanceof FieldTransition && block.edge.start.outEdges.size === 1) {
      // This field assignment was rendered before
      return "";
    }
    const followingField = find(block.edge.dest.outEdges, ({ transition: f }) =>
      f instanceof FieldTransition && f.transition === t ? f : null
    );
    const hasOnlyOneTransitionNext = block.edge.dest.outEdges.size === 1;
    if (followingField) {
      if (hasOnlyOneTransitionNext) {
        return `${indent}${this.renderField(
          followingField,
          this.renderTransition(t)
        )};`;
      }
      return `${indent}${this.markLocal("$val")} = ${this.renderTransition(
        t
      )};`;
    }
    return `${indent}${this.renderTransition(t)};`;
  }

  private renderTransition(t: AnyTransition): string {
    if (t instanceof RangeTransition) {
      if (t.from === t.to) {
        return `this.expect(${t.from})`;
      }
      return `this.expect2(${t.from}, ${t.to})`;
    }
    if (t instanceof CallTransition) {
      const type = this.grammar.getRule(t.ruleName).type;
      return `this.${type}${t.ruleName}(${t.args
        .map(a => this.renderCode(a))
        .join(", ")})`;
    }
    if (t instanceof FieldTransition) {
      return this.renderField(t, this.markLocal("$val"));
    }
    if (t instanceof ActionTransition) {
      return this.renderCode(t.code);
    }
    if (t instanceof PredicateTransition) {
      return "// TODO predicate";
    }
    if (t instanceof ReturnTransition) {
      return `return ${this.renderCode(t.returnCode)}`;
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
        return this.renderExpectBlock(indent, block);
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
    const args =
      this.rule.type === "rule" ? this.rule.args.map(a => a.arg).join(",") : "";
    const vars = [
      ...Array.from(this.internalVars),
      ...Array.from(this.rule.fields).map(([name, [{ multiple }]]) =>
        multiple ? `${name}=[]` : `${name}=null`
      ),
    ];
    const decls = vars.length > 0 ? `\n  let ${vars.join(", ")};` : "";
    return `${this.rule.type}${this.rule.name}(${args}) {${decls}\n${rendered}\n}`;
  }
}
