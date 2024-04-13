import {
  Analyzer,
  DecisionAnd,
  DecisionExpr,
  DecisionOr,
  DecisionTestFollow,
  DecisionTestRange,
  DecisionTree,
  FALSE,
  FollowStack,
} from "../analysis/analysis";
import {
  ActionTransition,
  AnyTransition,
  AssignableTransition,
  CallTransition,
  EpsilonTransition,
  FieldInfo,
  PredicateTransition,
  RangeTransition,
  ReturnTransition,
} from "../automaton/transitions";
import { FollowInfo } from "../grammar/follow-info";
import { AugmentedDeclaration, Grammar } from "../grammar/grammar";
import { ExprRule } from "../grammar/grammar-builder";
import { lines, never } from "../utils/index";
import {
  CodeBlock,
  DecisionBlock,
  endsWithFlowBreak,
  ExpectBlock,
} from "./dfa-to-code/cfg-to-code";
import { ParserCFGEdge, ParserCFGNode } from "./dfa-to-code/dfa-to-cfg";

export class ParserGenerator {
  private readonly grammar: Grammar;
  private readonly analyzer: Analyzer;
  private readonly rule: AugmentedDeclaration;
  private nodes: Map<ParserCFGNode, number>;
  private nodeUuid: number;
  private internalVars: Set<string>;
  private breaksStack: string[];
  private continuesStack: string[];
  private neededLabels: Set<string>;
  private DEBUG = true;

  constructor(
    grammar: Grammar,
    analyzer: Analyzer,
    rule: AugmentedDeclaration
  ) {
    this.grammar = grammar;
    this.analyzer = analyzer;
    this.rule = rule;
    this.nodes = new Map();
    this.nodeUuid = 1;
    this.internalVars = new Set();
    this.breaksStack = [];
    this.continuesStack = [];
    this.neededLabels = new Set();
  }

  private lastBreakScope() {
    return this.breaksStack[this.breaksStack.length - 1];
  }

  private lastContinueScope() {
    return this.continuesStack[this.continuesStack.length - 1];
  }

  private nodeId(node: ParserCFGNode) {
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

  private renderParentheses(yes: boolean, what: string) {
    return yes ? `(${what})` : what;
  }

  private optimizeDecision(expr: DecisionExpr) {
    return expr; // TODO refactor expressions

    // ($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */])) || ($ll1 === 2 /*#string:B*/ && this.ctx.f([3/* Tricky1 1 */, 4/* Tricky1 4 */]))){
    // turn into $ctx1 == 1 && $ctx2 == 2
  }

  renderDecision(expr: DecisionExpr, first = false): string {
    if (expr instanceof DecisionOr) {
      if (expr.exprs.length === 0) {
        return "false";
      }
      return this.renderParentheses(
        !first,
        expr.exprs.map(r => this.renderDecision(r)).join(" || ")
      );
    }
    if (expr instanceof DecisionAnd) {
      if (expr.exprs.length === 0) {
        return "true";
      }
      return this.renderParentheses(
        !first,
        expr.exprs.map(r => this.renderDecision(r)).join(" && ")
      );
    }
    if (expr instanceof DecisionTestFollow) {
      return this.renderFollowCondition(expr);
    }
    return this.renderRangeCondition(expr);
  }

  /*private renderConditionOr(conditions: DecisionOr) {
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
      return this.renderCondition(condition[0]);
    }
    return "(" + condition.map(r => this.renderCondition(r)).join(" && ") + ")";
  }*/

  private renderFollowInfo(info: FollowInfo) {
    return `${info.id}${
      this.DEBUG ? `/* ${info.rule} ${info.enterState.id} */` : ""
    }`;
  }

  private renderFollowCondition(test: DecisionTestFollow) {
    let f: FollowStack | null = test.follow;
    const array = [];
    do {
      array.push(this.renderFollowInfo(f.info));
      f = f.child;
    } while (f);
    return `this.ctx.f([${array.join(", ")}])`;
  }

  private renderRangeCondition(test: DecisionTestRange) {
    const {
      range: { from, to },
      ll,
    } = test;
    this.markVar("$ll" + ll);
    return from === to
      ? `$ll${ll} === ${this.renderNum(from)}`
      : `${this.renderNum(from)} <= $ll${ll} && $ll${ll} <= ${this.renderNum(
          to
        )}`;
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
      case "bool":
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
        return `this.${
          code.id.startsWith("$") ? code.id : `external.${code.id}`
        }(${code.args.map(e => this.renderCode(e)).join(", ")})`;
      default:
        never(code);
    }
  }

  private renderField(t: FieldInfo, what: string) {
    this.markVar(t.name);
    return t.multiple ? `${t.name}.push(${what})` : `${t.name} = ${what}`;
  }

  renderExpectBlock(indent: string, block: ExpectBlock): string {
    const t = block.transition;
    if (t instanceof AssignableTransition) {
      if (t.field) {
        return `${indent}${this.renderField(
          t.field,
          this.renderTransition(block.transition)
        )};`;
      }
    }
    return `${indent}${this.renderTransition(block.transition)};`;
  }

  private renderTransition(t: AnyTransition): string {
    if (t instanceof RangeTransition) {
      if (t.from === t.to) {
        return `this.$e(${this.renderNum(t.from)})`;
      }
      return `this.$e2(${this.renderNum(t.from)}, ${this.renderNum(t.to)})`;
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

  private markTransitionAfterDispatch(indent: string, edge: ParserCFGEdge) {
    return edge.originalDest
      ? `${indent}  ${this.markVar(
          `$d${this.nodeId(edge.dest)}`
        )} = ${this.nodeId(edge.originalDest)};`
      : "";
  }

  private renderDecisionTree(
    block: DecisionBlock,
    indent: string,
    tree: DecisionTree
  ) {
    const ll = tree.ll;
    let code = `${indent}${this.markVar(
      "$ll" + ll
    )} = this.$ll(${ll});\n${indent}`;

    const bodyToIf = new Map<string, DecisionExpr>();
    for (const decision of tree.iterate()) {
      const nextTree = decision.getNextTree();
      let nestedCode;
      if (nextTree?.worthIt()) {
        nestedCode = this.renderDecisionTree(block, `${indent}  `, nextTree);
      } else {
        const nestedBlocks = block.choices.filter(([transition, _]) =>
          decision.hasGoto(transition)
        );
        const nestedBlocksCode = nestedBlocks.map(([_, block], idx) =>
          idx === 0
            ? this.r(`${indent}  `, block)
            : block.type === "empty_block"
            ? `${indent}  //Ambiguity\n${indent}  // epsilon`
            : this.r(`${indent}  //Ambiguity\n${indent}  `, block)
        );
        nestedCode = lines(
          nestedBlocksCode.length === 1
            ? nestedBlocksCode
            : [`${indent}  throw new Error("Ambiguity");`, ...nestedBlocksCode]
        );
      }

      // TODO nestedCode += this.markTransitionAfterDispatch(indent, t);

      const currExpr = bodyToIf.get(nestedCode) ?? FALSE;
      bodyToIf.set(nestedCode, currExpr.or(decision.toExpr()));
    }

    const bodyToIfArr = Array.from(bodyToIf);
    for (const [nestedCode, condition] of bodyToIfArr.slice(0, -1)) {
      code += lines([
        `if(${this.renderDecision(this.optimizeDecision(condition), true)}){`,
        nestedCode,
        `${indent}} else `,
      ]);
    }

    // Optimize: no need for the last "if", just use "else"
    const [nestedCode, condition] = bodyToIfArr[bodyToIfArr.length - 1];
    code += lines([
      `{ //${this.renderDecision(this.optimizeDecision(condition), true)}`,
      nestedCode,
      `${indent}}`,
    ]);
    // code += `{\n${indent}  this.$err();\n${indent}}`;
    return code;
  }

  private r(indent: string, block: CodeBlock): string {
    switch (block.type) {
      case "expect_block":
        return this.renderExpectBlock(indent, block);
      case "seq_block":
        return lines(block.blocks.map(b => this.r(indent, b)));
      case "decision_block": {
        let code = "";
        const { tree, inverted: choices } = this.analyzer.analyze(
          this.rule,
          block.state
        );
        if (choices.compatibleWithSwitch) {
          this.breaksStack.push("");
          code = lines([
            `${indent}switch(this.$ll(1)){`,
            ...block.choices.map(([t, d]) => {
              const caseConditions = choices.get(t);
              const cases =
                caseConditions instanceof DecisionOr
                  ? caseConditions.exprs
                  : [caseConditions];
              const casesStr = cases.map(
                c =>
                  `${indent}  case ${this.renderNum(
                    (c as DecisionTestRange).range.from
                  )}:`
              );
              return lines([
                ...(casesStr.length ? casesStr : [`${indent}  case NaN:`]),
                this.r(`${indent}    `, d),
                // TODO this.markTransitionAfterDispatch(indent, t),
                endsWithFlowBreak(d) ? "" : `${indent}    break;`,
              ]);
            }),
            `${indent}  default:\n${indent}    this.$err();\n${indent}}`,
          ]);
          this.breaksStack.pop();
        } else {
          // TODO optimize to refactor common decisions
          code = this.renderDecisionTree(block, indent, tree);
          /*code =
            lines(
              Array.from(range(1, choices.maxLL)).map(
                n => `${indent}${this.markVar("$ll" + n)} = this.$ll(${n});`
              )
            ) +
            `\n${indent}` +
            lines(
              [
                ...block.choices.map(([t, d]) => {
                  const cases = choices.get(t);
                  return lines([
                    `if(${this.renderConditionOr(cases)}){`,
                    this.r(`${indent}  `, d),
                    // TODO this.markTransitionAfterDispatch(indent, t),
                    `${indent}}`,
                  ]);
                }),
                `{\n${indent}  this.$err();\n${indent}}`,
              ],
              " else "
            );*/
        }
        return code;
      }
      case "scope_block": {
        this.breaksStack.push(block.label);
        const code = this.r(indent + "  ", block.block);
        this.breaksStack.pop();
        return lines([
          `${indent}${
            this.neededLabels.has(block.label) ? `${block.label}:` : ""
          }do{`,
          code,
          `${indent}}while(0);`,
        ]);
      }
      case "loop_block": {
        this.breaksStack.push(block.label);
        this.continuesStack.push(block.label);
        const code = this.r(indent + "  ", block.block);
        this.continuesStack.pop();
        this.breaksStack.pop();
        return lines([
          `${indent}${
            this.neededLabels.has(block.label) ? `${block.label}:` : ""
          }while(1){`,
          code,
          `${indent}}`,
        ]);
      }
      case "break_block": {
        if (this.lastBreakScope() === block.label) {
          return `${indent}break;`;
        } else {
          this.neededLabels.add(block.label);
          return `${indent}break ${block.label};`;
        }
      }
      case "continue_block":
        if (this.lastContinueScope() === block.label) {
          return `${indent}continue;`;
        } else {
          this.neededLabels.add(block.label);
          return `${indent}continue ${block.label};`;
        }
      case "empty_block":
        return "";
      case "dispatch_block":
        throw new Error("TODO");
      /*return lines([
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
        ]);*/
      default:
        never(block);
    }
  }

  process(indent: string, block: CodeBlock) {
    const { type, name, args, fields } = this.rule;

    const rendered = this.r(`${indent}  `, block);
    const vars = [
      ...Array.from(this.internalVars),
      ...Array.from(fields).map(([name, [{ multiple }]]) =>
        multiple ? `${name}=[]` : `${name}=null`
      ),
    ].filter(Boolean);

    const decls = vars.length > 0 ? `\n${indent}  let ${vars.join(", ")};` : "";
    return `${indent}${type}${name}(${args
      .map(a => `${a.arg}`)
      .join(",")}) {${decls}\n${rendered}\n${indent}}`;
  }

  private useStackContext = true;

  setUseStackContext(bool: boolean) {
    this.useStackContext = bool;
  }
}
