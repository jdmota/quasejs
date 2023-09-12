import {
  Analyzer,
  DecisionAnd,
  DecisionOr,
  DecisionTest,
  FollowStack,
} from "../analysis/analysis";
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
import { FollowInfo } from "../grammar/follow-info";
import { Grammar } from "../grammar/grammar";
import { Declaration, ExprRule } from "../grammar/grammar-builder";
import { any, assertion, find, lines, never } from "../utils";
import { range } from "../utils/range-utils";
import {
  CodeBlock,
  endsWithFlowBreak,
  ExpectBlock,
} from "./dfa-to-code/cfg-to-code";
import { CFGEdge, CFGNode, DispatchTransition } from "./dfa-to-code/dfa-to-cfg";

export class ParserGenerator {
  private readonly grammar: Grammar;
  private readonly analyzer: Analyzer;
  private readonly rule: Declaration;
  private nodes: Map<CFGNode, number>;
  private nodeUuid: number;
  private internalVars: Set<string>;
  private DEBUG = true;

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

  private markVar(name: string) {
    if (!this.rule.fields.has(name)) {
      this.internalVars.add(name);
    }
    return name;
  }

  private renderConditionOr(conditions: DecisionOr) {
    if (conditions.length === 0) {
      return "false";
    }
    return conditions.map(r => this.renderConditionAnd(r)).join(" || ");
  }

  renderConditionAnd(condition: DecisionAnd) {
    if (condition.length === 0) {
      return "true";
    }
    if (condition.length === 1) {
      return this.renderCondition(1, condition[0]);
    }
    return (
      "(" +
      condition.map((r, i) => this.renderCondition(i + 1, r)).join(" && ") +
      ")"
    );
  }

  private renderFollowInfo(info: FollowInfo) {
    return `${info.id}${
      this.DEBUG ? `/* ${info.rule} ${info.enterState.id} */` : ""
    }`;
  }

  private renderFollowCondition(follow: FollowStack | null) {
    let f = follow;
    const array = [];
    while (f) {
      array.push(this.renderFollowInfo(f.info));
      f = f.child;
    }
    return array.length ? `this.ctx.f([${array.join(", ")}])` : null;
  }

  private renderCondition(ll: number, test: DecisionTest) {
    const {
      follow,
      range: { from, to },
    } = test;
    this.markVar("$ll" + ll);
    return [
      from === to
        ? `$ll${ll} === ${this.renderNum(from)}`
        : `${this.renderNum(from)} <= $ll${ll} && $ll${ll} <= ${this.renderNum(
            to
          )}`,
      this.renderFollowCondition(follow),
    ]
      .filter(Boolean)
      .join(" && ");
  }

  private renderNum(num: number) {
    return `${num}${
      this.DEBUG
        ? ` /*${this.grammar.userFriendlyName(
            num,
            this.rule.type === "token"
          )}*/`
        : ""
    }`;
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
        return `this.${code.id.startsWith("$") ? "" : "external."}${
          code.id
        }(${code.args.map(e => this.renderCode(e)).join(", ")})`;
      default:
        never(code);
    }
  }

  private renderField(t: FieldTransition, what: string) {
    this.markVar(t.name);
    return t.multiple
      ? `(${t.name} = ${t.name} || []).push(${what})`
      : `${t.name} = ${what}`;
  }

  // This method detects if we need to save a value for later assignment
  // And writes "field = 2;" instead of "$val = 2; field = $val;" if possible
  private renderExpectBlock(indent: string, block: ExpectBlock): string {
    const t = block.edge.transition;
    if (t instanceof FieldTransition && block.edge.start.outEdges.size === 1) {
      // This field assignment was rendered before
      return "";
    }
    const followingField = find(block.edge.dest.outEdges, ({ transition: f }) =>
      f instanceof FieldTransition && f.transition.equals(t) ? f : null
    );
    if (followingField) {
      const hasOnlyOneTransitionNext = block.edge.dest.outEdges.size === 1;
      if (hasOnlyOneTransitionNext) {
        return `${indent}${this.renderField(
          followingField,
          this.renderTransition(t)
        )};`;
      }
      return `${indent}${this.markVar("$val")} = ${this.renderTransition(t)};`;
    }
    return `${indent}${this.renderTransition(t)};`;
  }

  renderTransition(t: AnyTransition): string {
    if (t instanceof RangeTransition) {
      if (t.from === t.to) {
        return `this.e(${this.renderNum(t.from)})`;
      }
      return `this.e2(${this.renderNum(t.from)}, ${this.renderNum(t.to)})`;
    }
    if (t instanceof CallTransition) {
      const type = this.grammar.getRule(t.ruleName).type;
      const code = `this.${type}${t.ruleName}(${t.args
        .map(a => this.renderCode(a))
        .join(", ")})`;
      return this.useStackContext
        ? `this.ctx.u(${this.renderFollowInfo(
            this.analyzer.follows.getByTransition(t)
          )}, ${code})`
        : code;
    }
    if (t instanceof FieldTransition) {
      return this.renderField(t, this.markVar("$val"));
    }
    if (t instanceof ActionTransition) {
      return this.renderCode(t.code);
    }
    if (t instanceof PredicateTransition) {
      return "/* TODO predicate */";
    }
    if (t instanceof ReturnTransition) {
      return this.useStackContext
        ? `return this.ctx.o(${this.renderCode(t.returnCode)})`
        : `return ${this.renderCode(t.returnCode)}`;
    }
    if (t instanceof EpsilonTransition) {
      return "/* EPSILON */";
    }
    never(t);
  }

  private markTransitionAfterDispatch(indent: string, edge: CFGEdge) {
    return edge.originalDest
      ? `${indent}  ${this.markVar(
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
            `${indent}switch(${this.markVar(`$d${this.nodeId(block.node)}`)}){`,
            ...block.choices.map(([t, d]) => {
              assertion(t.transition instanceof DispatchTransition);
              return lines([
                `${indent}  case ${this.nodeId(t.dest)}:`,
                this.r(`${indent}    `, d),
                endsWithFlowBreak(d) ? "" : `${indent}    break;`,
              ]);
            }),
            `${indent}}`,
          ]);
        }
        const choices = this.analyzer.analyze(
          this.rule,
          block.node.state
        ).inverted;
        if (block.choices.length >= 2 && choices.compatibleWithSwitch) {
          return lines([
            `${indent}switch(this.ll(1)){`,
            ...block.choices.map(([t, d]) => {
              const casesStr = choices
                .get(t.transition)
                .map(
                  c => `${indent}  case ${this.renderNum(c[0].range.from)}:`
                );
              return lines([
                ...(casesStr.length ? casesStr : [`${indent}  case NaN:`]),
                this.r(`${indent}    `, d),
                this.markTransitionAfterDispatch(indent, t),
                endsWithFlowBreak(d) ? "" : `${indent}    break;`,
              ]);
            }),
            `${indent}  default:\n` +
              (block.default
                ? this.r(`${indent}    `, block.default)
                : `${indent}    this.err();`) +
              `\n${indent}}`,
          ]);
        }
        return (
          lines(
            Array.from(range(1, choices.maxLL)).map(
              n => `${indent}${this.markVar("$ll" + n)} = this.ll(${n});`
            )
          ) +
          `\n${indent}` +
          lines(
            [
              ...block.choices.map(([t, d]) => {
                const cases = choices.get(t.transition);
                return lines([
                  `if(${this.renderConditionOr(cases)}){`,
                  this.r(`${indent}  `, d),
                  this.markTransitionAfterDispatch(indent, t),
                  `${indent}}`,
                ]);
              }),
              `{\n${
                block.default
                  ? this.r(`${indent}  `, block.default)
                  : `${indent}  this.err();`
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

  process(indent: string, block: CodeBlock) {
    const rendered = this.r(`${indent}  `, block);
    const args =
      this.rule.type === "rule" ? this.rule.args.map(a => a.arg).join(",") : "";
    const vars = [
      ...Array.from(this.internalVars),
      ...Array.from(this.rule.fields).map(([name, [{ multiple }]]) =>
        multiple ? `${name}=[]` : `${name}:any=null`
      ),
    ];
    const decls = vars.length > 0 ? `\n${indent}  let ${vars.join(", ")};` : "";
    return `${indent}${this.rule.type}${this.rule.name}(${args}) {${decls}\n${rendered}\n${indent}}`;
  }

  private useStackContext = true;

  setUseStackContext(bool: boolean) {
    this.useStackContext = bool;
  }
}
