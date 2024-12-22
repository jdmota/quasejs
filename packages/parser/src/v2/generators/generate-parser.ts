import {
  assertion,
  lines,
  never,
  nonNull,
} from "../../../../util/miscellaneous.ts";
import { range } from "../../../../util/range-utils.ts";
import { DEBUG_apply, DEBUG_unapply } from "../analysis/analysis-debug.ts";
import { DecisionTree } from "../analysis/decision-trees.ts";
import {
  DecisionAnd,
  DecisionExpr,
  DecisionOr,
  DecisionTestFollow,
  DecisionTestToken,
  FALSE,
} from "../analysis/decision-expr.ts";
import {
  ActionTransition,
  AnyTransition,
  AssignableTransition,
  CallTransition,
  EpsilonTransition,
  FieldInfo,
  FieldTransition,
  PredicateTransition,
  RangeTransition,
  ReturnTransition,
} from "../automaton/transitions.ts";
import { AugmentedDeclaration, Grammar } from "../grammar/grammar.ts";
import { ExprRule } from "../grammar/grammar-builder.ts";
import { DecisionBlock, endsWithFlowBreak } from "./dfa-to-code/cfg-to-code.ts";
import {
  DStateEdge,
  ParserCFGEdge,
  ParserCFGNode,
} from "./parser-dfa-to-cfg.ts";
import type {
  ParserCodeBlock,
  ParserSimpleBlock,
} from "./parser-cfg-to-code.ts";
import { DState } from "../automaton/state.ts";
import { IAnalyzer } from "../analysis/analysis-reference.ts";
import { MapKeyToValue } from "../../../../util/data-structures/map-key-to-value.ts";
import { labelToStr } from "../runtime/gll.ts";

export class LabelsManager {
  private readonly map = new MapKeyToValue<DStateEdge, number>();
  private readonly queue: [DStateEdge, number][] = [];
  private uuid = 0;

  constructor(private readonly needGLL: ReadonlySet<string>) {}

  needsGLL(name: string) {
    return this.needGLL.has(name);
  }

  needsGLLCall<I extends AnyTransition | null, T>(
    t: I,
    then: (t: CallTransition) => T,
    elsee: (t: I) => T
  ) {
    return t instanceof CallTransition && this.needGLL.has(t.ruleName)
      ? then(t)
      : elsee(t);
  }

  private process(t: AnyTransition | null) {
    return this.needsGLLCall(
      t,
      t => (t.field ? new FieldTransition(t.field) : null),
      t => t
    );
  }

  get(t: AnyTransition | null, dest: DState) {
    return nonNull(this.map.get(new DStateEdge(this.process(t), dest)));
  }

  add(t: AnyTransition | null, dest: DState) {
    const edge = new DStateEdge(this.process(t), dest);
    const nextId = this.uuid;
    const id = this.map.computeIfAbsent(edge, () => this.uuid++);
    if (nextId < this.uuid) {
      this.queue.push([edge, id]);
    }
    return id;
  }

  *[Symbol.iterator]() {
    let next;
    while ((next = this.queue.shift())) {
      yield next;
    }
  }
}

export class ParserGenerator {
  private nodes: Map<ParserCFGNode, number>;
  private nodeUuid: number;
  private internalVars: Set<string>;
  private breaksStack: string[];
  private continuesStack: string[];
  private neededLabels: Set<string>;
  private readonly needsGLL: boolean;
  private useStackContext = true;
  private DEBUG = true;

  constructor(
    private readonly grammar: Grammar,
    private readonly analyzer: IAnalyzer<any>,
    private readonly decl: AugmentedDeclaration,
    private readonly labels: LabelsManager,
    private readonly fields: Map<string, boolean>
  ) {
    this.nodes = new Map();
    this.nodeUuid = 1;
    this.internalVars = new Set();
    this.breaksStack = [];
    this.continuesStack = [];
    this.neededLabels = new Set();
    this.needsGLL = labels.needsGLL(decl.name);
  }

  reset() {
    this.nodes.clear();
    this.nodeUuid = 1;
    this.internalVars.clear();
    this.breaksStack.length = 0;
    this.continuesStack.length = 0;
    this.neededLabels.clear();
    this.useStackContext = true;
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

  private markInternalVar(name: string) {
    this.internalVars.add(name);
    return name;
  }

  private renderParentheses(yes: boolean, what: string) {
    return yes ? `(${what})` : what;
  }

  private optimizeDecision(expr: DecisionExpr) {
    return expr;
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

  private renderNum(num: number) {
    return `${num}${
      this.DEBUG
        ? ` /*${this.grammar.userFriendlyName(
            num,
            this.decl.type === "token"
          )}*/`
        : ""
    }`;
  }

  private renderFollowInfo(id: number) {
    if (id < 0) {
      return `${id}`;
    }
    const info = this.grammar.follows.getById(id);
    return `${id}${this.DEBUG ? ` /* ${info.rule} ${info.exitState.id} */` : ""}`;
  }

  private renderFollowInfoOfCall(t: CallTransition) {
    return this.renderFollowInfo(this.analyzer.follows.getByTransition(t).id);
  }

  private renderFollowCondition(test: DecisionTestFollow) {
    const { ff, from, to } = test;
    this.markInternalVar("$ff" + ff);
    return from === to
      ? `$ff${ff} === ${this.renderFollowInfo(from)}`
      : `${from} <= $ff${ff} && $ff${ff} <= ${to}`;
  }

  private renderRangeCondition(test: DecisionTestToken) {
    const { ll, from, to } = test;
    this.markInternalVar("$ll" + ll);
    return from === to
      ? `$ll${ll} === ${this.renderNum(from)}`
      : `${this.renderNum(from)} <= $ll${ll} && $ll${ll} <= ${this.renderNum(
          to
        )}`;
  }

  private renderCode(code: ExprRule): string {
    switch (code.type) {
      case "id":
        return this.renderId(code.id);
      case "bool":
      case "int":
        return `${code.value}`;
      case "null":
        return "null";
      case "string":
        return JSON.stringify(code.string);
      case "object":
        return code.fields.length === 0
          ? "$$EMPTY_OBJ"
          : `{${code.fields
              .map(([k, v]) => {
                const vCode = this.renderCode(v);
                return k === vCode ? k : `${k}:${vCode}`;
              })
              .join(",")}}`;
      case "call2":
        return `this.${
          code.id.startsWith("$") ? code.id : `external.${code.id}`
        }(${code.args.map(e => this.renderCode(e)).join(",")})`;
      default:
        never(code);
    }
  }

  private renderId(id: string) {
    return this.needsGLL ? `$env.${id}` : id;
  }

  private renderField(t: FieldInfo, what: string) {
    return t.multiple
      ? `${this.renderId(t.name)}.push(${what})`
      : `${this.renderId(t.name)} = ${what}`;
  }

  private renderRuleName(rule: AugmentedDeclaration, label: number) {
    return labelToStr(rule.type, { rule: rule.name, label });
  }

  renderExpectBlock(
    indent: string,
    block: ParserSimpleBlock,
    returnn: boolean
  ): string {
    switch (block.type) {
      case "expect_block": {
        const t = block.transition;
        const end =
          returnn && !(t instanceof ReturnTransition)
            ? `\n${indent}return;`
            : "";
        if (t instanceof AssignableTransition && t.field) {
          return `${indent}${this.renderField(
            t.field,
            this.renderTransition(block.transition, block.dest)
          )};${end}`;
        }
        return `${indent}${this.renderTransition(block.transition, block.dest)};${end}`;
      }
      case "ambiguity_block": {
        assertion(this.needsGLL);
        return lines([
          `${indent}// Ambiguity`,
          `${indent}this.gll.u(this.$i(),$env);`,
          ...block.choices.map(({ transition: t, label }) =>
            this.labels.needsGLLCall(
              t,
              t =>
                `${indent}this.gll.c("${this.decl.name}",${label},"${t.ruleName}",[${t.args.map(a => this.renderCode(a)).join(",")}]);`,
              t => `${indent}this.gll.a("${this.decl.name}",${label},$env);`
            )
          ),
          `${indent}return;`,
        ]);
      }
      default:
        never(block);
    }
  }

  private renderTransition(t: AnyTransition, dest: DState): string {
    if (t instanceof RangeTransition) {
      if (t.from === t.to) {
        return `this.$e(${this.renderNum(t.from)})`;
      }
      return `this.$e2(${this.renderNum(t.from)}, ${this.renderNum(t.to)})`;
    }
    if (t instanceof FieldTransition) {
      return this.renderField(t.field, `$env["#tmp"]`);
    }
    if (t instanceof CallTransition) {
      const renderedFollowInfo = this.renderFollowInfoOfCall(t);
      const renderedArgs = t.args.map(a => this.renderCode(a)).join(",");
      return this.labels.needsGLLCall(
        t,
        t => {
          return `(this.gll.u(this.$i(),$env), this.gll.c("${this.decl.name}",${this.labels.get(t, dest)},"${t.ruleName}",[${renderedArgs}]))`;
        },
        t => {
          const rule = this.grammar.getRule(t.ruleName);
          const code = `this.${this.renderRuleName(rule, 0)}(${renderedArgs})`;
          return this.useStackContext
            ? `this.ctx.p(${renderedFollowInfo}, () => ${code})`
            : code;
        }
      );
    }
    if (t instanceof ActionTransition) {
      return this.renderCode(t.code);
    }
    if (t instanceof PredicateTransition) {
      return "/* TODO predicate */";
    }
    if (t instanceof ReturnTransition) {
      if (this.needsGLL) {
        return `return (this.gll.u(this.$i(),$env), this.gll.p(${this.renderCode(t.returnCode)}))`;
      }
      return `return ${this.renderCode(t.returnCode)}`;
    }
    if (t instanceof EpsilonTransition) {
      return "/* EPSILON */";
    }
    never(t);
  }

  private markTransitionAfterDispatch(indent: string, edge: ParserCFGEdge) {
    return edge.originalDest
      ? `${indent}  ${this.markInternalVar(
          `$d${this.nodeId(edge.dest)}`
        )} = ${this.nodeId(edge.originalDest)};`
      : "";
  }

  private renderDecisionBlock(
    indent: string,
    transition: AnyTransition,
    block: ParserCodeBlock,
    idx: number,
    first: boolean
  ) {
    let code = first ? "" : `${indent}//Ambiguity\n`;
    return code + `${indent}${this.markInternalVar("$dd")} = ${idx};`;
    // return code + this.r(indent, block);
  }

  private renderDecisionTree(
    block: DecisionBlock<
      ParserCFGNode<DState, AnyTransition>,
      DState,
      AnyTransition
    >,
    indent: string,
    tree: DecisionTree<any>
  ) {
    this.markInternalVar("$dd");

    let code;
    if ("ll" in tree) {
      const ll = tree.ll;
      code = `${indent}${this.markInternalVar(
        "$ll" + ll
      )} = this.$ll(${ll});\n${indent}`;
    } else {
      const ff = tree.ff;
      code = `${indent}${this.markInternalVar(
        "$ff" + ff
      )} = this.ctx.ff(${ff});\n${indent}`;
    }

    if (tree.hasAnyDecisions()) {
      code += lines([
        `if(true){`,
        this.renderDecisions(
          block,
          t => tree.hasAnyGoto(t),
          indent,
          true,
          "Left recursion"
        ),
        `${indent}}`,
      ]);
    }

    const bodyToIf = new Map<string, DecisionExpr>();
    for (const decision of tree.iterate()) {
      const nextTree = decision.getNextTree();
      let nestedCode;
      if (nextTree?.worthIt()) {
        nestedCode = this.renderDecisionTree(block, `${indent}  `, nextTree);
      } else {
        nestedCode = this.renderDecisions(
          block,
          t => decision.hasGoto(t),
          indent,
          decision.isAmbiguous(),
          "Ambiguity"
        );
      }

      // TODO nestedCode += this.markTransitionAfterDispatch(indent, t);

      const currExpr = bodyToIf.get(nestedCode) ?? FALSE;
      bodyToIf.set(nestedCode, currExpr.or(decision.decision));
    }

    if (bodyToIf.size) {
      if (tree.hasAnyDecisions()) code += `\n${indent}`;

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
    }
    return code;
  }

  private renderDecisions(
    block: DecisionBlock<
      ParserCFGNode<DState, AnyTransition>,
      DState,
      AnyTransition
    >,
    hasGoto: (goto: AnyTransition) => boolean,
    indent: string,
    error: boolean,
    errorMessage: string
  ) {
    const nestedBlocks = block.choices
      .map(
        ([transition, block], idx) =>
          [transition, block, idx, hasGoto(transition)] as const
      )
      .filter(([_1, _2, _3, has]) => has);
    const nestedBlocksCode = nestedBlocks.map(
      ([transition, block, decisionIdx], idx) =>
        this.renderDecisionBlock(
          `${indent}  `,
          transition,
          block,
          decisionIdx,
          idx === 0
        )
    );
    const nestedCode = lines(
      error
        ? [
            `${indent}  throw new Error("${errorMessage}");`,
            ...nestedBlocksCode,
          ]
        : nestedBlocksCode
    );
    return nestedCode;
  }

  private r(indent: string, block: ParserCodeBlock): string {
    switch (block.type) {
      case "simple_block":
        return this.renderExpectBlock(indent, block.block, block.return);
      case "seq_block":
        return lines(block.blocks.map(b => this.r(indent, b)));
      case "decision_block": {
        const bodyToIf = new Map<string, DecisionExpr>();
        for (const [expr, d] of block.choices) {
          const nestedCode = this.r(`${indent}  `, d);
          const currExpr = bodyToIf.get(nestedCode) ?? FALSE;
          bodyToIf.set(nestedCode, currExpr.or(expr));
        }

        const {
          metadata: { decisionOn, decisionIdx },
        } = block;

        let code = `${indent}${this.markInternalVar(`$${decisionOn}${decisionIdx}`)}=this.$${decisionOn}(${decisionIdx});\n${indent}`;

        const bodyToIfArr = Array.from(bodyToIf);
        for (const [nestedCode, condition] of bodyToIfArr) {
          code += lines([
            `if(${this.renderDecision(this.optimizeDecision(condition), true)}){`,
            nestedCode,
            `${indent}} else `,
          ]);
        }
        code += `{\n${indent}  this.$err();\n${indent}}`;

        /*const { tree, inverted: choices } = this.analyzer.analyze(
          this.rule,
          block.state
        );
        if (choices.ok) {
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
                      (c as DecisionTestToken).from
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
            code +=
              `${indent}` +
              Array.from(range(1, choices.maxLL))
                .map(n => `${this.markVar("$ll" + n)} = this.$ll(${n});`)
                .join(" ") +
              " " +
              Array.from(range(1, choices.maxFF))
                .map(n => `${this.markVar("$ff" + n)} = this.$ff(${n});`)
                .join(" ");
            code +=
              `\n${indent}` +
              lines(
                [
                  ...block.choices.map(([t, d], decisionIdx) => {
                    const decision = choices.get(t);
                    return lines([
                      `if(${this.renderDecision(this.optimizeDecision(decision))}){`,
                      this.r(`${indent}  `, d),
                      // TODO this.markTransitionAfterDispatch(indent, t),
                      `${indent}}`,
                    ]);
                  }),
                  `{\n${indent}  this.$err();\n${indent}}`,
                ],
                " else "
              );
          }
        } else {
          code += this.renderDecisionTree(block, indent, tree);
          code +=
            `\n${indent}` +
            lines(
              [
                ...block.choices.map(([t, d], decisionIdx) => {
                  // const decision = choices.get(t);
                  return lines([
                    `if($dd === ${decisionIdx}){`, // this.renderDecision(this.optimizeDecision(decision))
                    this.r(`${indent}  `, d),
                    // TODO this.markTransitionAfterDispatch(indent, t),
                    `${indent}}`,
                  ]);
                }),
                `{\n${indent}  this.$err();\n${indent}}`,
              ],
              " else "
            );
        }*/
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
        return `${indent}// epsilon`;
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

  process(block: ParserCodeBlock, label: number) {
    DEBUG_apply(this.decl);
    const indent = "  ";
    const { args } = this.decl;
    const rendered = this.r(`${indent}  `, block);

    const env = this.needsGLL
      ? Array.from(this.internalVars)
      : [
          ...Array.from(this.internalVars),
          ...Array.from(this.fields).map(([name, multiple]) =>
            multiple ? `${name}=[]` : `${name}=null`
          ),
        ].filter(Boolean);

    const decls = env.length > 0 ? `\n${indent}  let ${env.join(",")};` : "";
    const result = `${indent}${this.renderRuleName(this.decl, label)}(${
      this.needsGLL ? "$env" : args.map(a => `${a.arg}`).join(",")
    }) {${decls}\n${rendered}\n${indent}}`;

    DEBUG_unapply();
    return result;
  }

  setUseStackContext(bool: boolean) {
    this.useStackContext = bool;
  }

  static genCreateInitialEnvFunc(
    allFields: Map<AugmentedDeclaration, Map<string, boolean>>,
    needGLL: ReadonlySet<string>
  ) {
    let forTokens = "  $createEnv(name,args){\n";
    let forRules = "  $createEnv(name,args){\n";
    for (const [decl, fields] of allFields) {
      if (needGLL.has(decl.name)) {
        const env = Array.from(fields)
          .map(([name, multiple]) => `${name}:${multiple ? "[]" : "null"}`)
          .concat(decl.args.map(({ arg }, i) => `${arg}:args[${i}]`))
          .join(",");
        const code = `    if(name==="${decl.name}") return {${env}};\n`;
        if (decl.type === "token") {
          forTokens += code;
        } else {
          forRules += code;
        }
      }
    }
    const endCode = `    throw new Error(\`Never: \${name} \${args}\`);\n  }`;
    forTokens += endCode;
    forRules += endCode;
    return { forTokens, forRules };
  }

  generateV2(indent: string, state: DState) {
    let code = "";
    if (choices.ok) {
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
                  (c as DecisionTestToken).from
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
        code +=
          `${indent}` +
          Array.from(range(1, choices.maxLL))
            .map(n => `${this.markVar("$ll" + n)} = this.$ll(${n});`)
            .join(" ") +
          " " +
          Array.from(range(1, choices.maxFF))
            .map(n => `${this.markVar("$ff" + n)} = this.$ff(${n});`)
            .join(" ");
        code +=
          `\n${indent}` +
          lines(
            [
              ...block.choices.map(([t, d], decisionIdx) => {
                const decision = choices.get(t);
                return lines([
                  `if(${this.renderDecision(this.optimizeDecision(decision))}){`,
                  this.r(`${indent}  `, d),
                  // TODO this.markTransitionAfterDispatch(indent, t),
                  `${indent}}`,
                ]);
              }),
              `{\n${indent}  this.$err();\n${indent}}`,
            ],
            " else "
          );
      }
    } else {
      code += this.renderDecisionTree(block, indent, tree);
      code +=
        `\n${indent}` +
        lines(
          [
            ...block.choices.map(([t, d], decisionIdx) => {
              // const decision = choices.get(t);
              return lines([
                `if($dd === ${decisionIdx}){`, // this.renderDecision(this.optimizeDecision(decision))
                this.r(`${indent}  `, d),
                // TODO this.markTransitionAfterDispatch(indent, t),
                `${indent}}`,
              ]);
            }),
            `{\n${indent}  this.$err();\n${indent}}`,
          ],
          " else "
        );
    }
    return code;
  }
}
