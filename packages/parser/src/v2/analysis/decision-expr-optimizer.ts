import { Frag, AbstractAutomaton } from "../automaton/automaton.ts";
import {
  ObjectHashEquals,
  lines,
  never,
} from "../../../../util/miscellaneous.ts";
import { MapKeyToValue } from "../../../../util/data-structures/map-key-to-value.ts";
import { MapKeyToSet } from "../../../../util/data-structures/map-key-to-set.ts";
import {
  DecisionAnd,
  DecisionExpr,
  DecisionOr,
  DecisionSingleton,
  DecisionTestFollow,
  DecisionTestToken,
} from "./decision-expr.ts";
import { AbstractNFAState, AbstractDFAState } from "../automaton/state.ts";
import {
  AbstractDfaMinimizer,
  AbstractNfaToDfa,
} from "../optimizer/abstract-optimizer.ts";
import {
  CfgToCode,
  CodeBlock,
  ExpectBlock,
  ReturnBlock,
} from "../generators/dfa-to-code/cfg-to-code.ts";
import { ParserCFGNode } from "../generators/dfa-to-code/dfa-to-cfg.ts";
import { Grammar, AugmentedDeclaration } from "../grammar/grammar.ts";
import { Analyzer } from "./analysis.ts";

type DecisionTransition = DecisionSingleton | DecisionReturn;

class DecisionReturn implements ObjectHashEquals {
  readonly option: number;

  constructor(option: number) {
    this.option = option;
  }

  hashCode(): number {
    return this.option;
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    if (other instanceof DecisionReturn) {
      return this.option === other.option;
    }
    return false;
  }

  toString() {
    return `(ret ${this.option})`;
  }
}

class DecisionNFAState extends AbstractNFAState<
  DecisionNFAState,
  DecisionTransition
> {
  readonly id: number;
  readonly mapKeyToSet: MapKeyToSet<
    DecisionTransition | null,
    DecisionNFAState
  >;

  constructor(id: number) {
    super();
    this.id = id;
    this.mapKeyToSet = new MapKeyToSet();
  }

  addTransition(transition: DecisionTransition, dest: DecisionNFAState) {
    this.mapKeyToSet.add(transition, new Set([dest]));
    return dest;
  }

  addEpsilon(dest: DecisionNFAState) {
    this.mapKeyToSet.add(null, new Set([dest]));
    return dest;
  }

  *[Symbol.iterator](): IterableIterator<
    readonly [DecisionTransition | null, ReadonlySet<DecisionNFAState>]
  > {
    for (const step of this.mapKeyToSet) {
      yield step;
    }
  }
}

class DecisionDFAState extends AbstractDFAState<
  DecisionDFAState,
  DecisionTransition
> {
  readonly id: number;
  readonly mapKeyToSet: MapKeyToValue<DecisionTransition, DecisionDFAState>;

  constructor(id: number) {
    super();
    this.id = id;
    this.mapKeyToSet = new MapKeyToValue();
  }

  addTransition(transition: DecisionTransition, dest: DecisionDFAState) {
    return this.mapKeyToSet.add(transition, dest);
  }

  addEpsilon(dest: DecisionDFAState) {
    throw new Error("");
  }

  override transitionAmount(): number {
    return this.mapKeyToSet.size;
  }

  override *[Symbol.iterator](): IterableIterator<
    readonly [DecisionTransition, DecisionDFAState]
  > {
    for (const step of this.mapKeyToSet) {
      yield step;
    }
  }
}

class DecisionAutomaton extends AbstractAutomaton<
  DecisionNFAState,
  DecisionTransition
> {
  private uuid = 1;

  newState(): DecisionNFAState {
    return new DecisionNFAState(this.uuid++);
  }
}

class FactoryDecisionExpr {
  readonly automaton: DecisionAutomaton;

  constructor() {
    this.automaton = new DecisionAutomaton();
  }

  static process(decision: DecisionExpr, option: number) {
    return new FactoryDecisionExpr().decision(decision, option);
  }

  and(decision: DecisionAnd) {
    return this.automaton.seq(decision.exprs.map(r => this.gen(r)));
  }

  or(decision: DecisionOr) {
    return this.automaton.choice(decision.exprs.map(r => this.gen(r)));
  }

  testToken(decision: DecisionTestToken) {
    return this.automaton.single(decision);
  }

  followToken(decision: DecisionTestFollow) {
    return this.automaton.single(decision);
  }

  gen(decision: DecisionExpr): Frag<DecisionNFAState, DecisionSingleton> {
    if (decision instanceof DecisionAnd) {
      return this.and(decision);
    }
    if (decision instanceof DecisionOr) {
      return this.or(decision);
    }
    if (decision instanceof DecisionTestToken) {
      return this.testToken(decision);
    }
    if (decision instanceof DecisionTestFollow) {
      return this.followToken(decision);
    }
    never(decision);
  }

  decision(decision: DecisionExpr, option: number) {
    return this.automaton.seq([
      this.gen(decision),
      this.automaton.single(new DecisionReturn(option)),
    ]);
  }
}

class DecisionNfaToDfa extends AbstractNfaToDfa<
  DecisionNFAState,
  DecisionDFAState,
  DecisionTransition
> {
  newDFAState(id: number) {
    return new DecisionDFAState(id);
  }

  addTransition(
    state: DecisionDFAState,
    transition: DecisionTransition,
    dest: DecisionDFAState
  ) {
    state.addTransition(transition, dest);
  }

  getEpsilonStates(state: DecisionNFAState) {
    return state.mapKeyToSet.get(null);
  }

  combinations(closure: DecisionNFAState[]) {
    const combination = new DecisionNFAState(0);
    for (const state of closure) {
      for (const [transition, set] of state.mapKeyToSet) {
        if (transition == null) {
          continue;
        }
        combination.mapKeyToSet.add(transition, set);
      }
    }
    // We are sure there is no "null" in the transitions now
    return combination[Symbol.iterator]() as IterableIterator<
      readonly [DecisionTransition, ReadonlySet<DecisionNFAState>]
    >;
  }
}

class DecisionDfaMinimizer extends AbstractDfaMinimizer<
  DecisionDFAState,
  DecisionTransition
> {
  newDFAState(id: number): DecisionDFAState {
    return new DecisionDFAState(id);
  }

  addTransition(
    state: DecisionDFAState,
    transition: DecisionTransition,
    dest: DecisionDFAState
  ): void {
    state.addTransition(transition, dest);
  }

  getTransitions(
    state: DecisionDFAState
  ): IterableIterator<readonly [DecisionTransition, DecisionDFAState]> {
    return state[Symbol.iterator]();
  }

  isDifferent(
    p: DecisionDFAState,
    q: DecisionDFAState,
    pairsTable: boolean[][]
  ): boolean {
    // If t(p, a), t(q, a) is marked, mark p, q
    // If t(p, a) exists and t(q, a) does not, mark p, q

    if (p.transitionAmount() !== q.transitionAmount()) {
      return true;
    }

    for (const [transition, pA] of p.mapKeyToSet) {
      const qA = q.mapKeyToSet.get(transition);
      if (qA) {
        if (pairsTable[pA.id][qA.id]) {
          return true;
        }
      } else {
        return true;
      }
    }

    return false;
  }
}

class DecisionGenerator {
  private readonly grammar: Grammar;
  private readonly analyzer: Analyzer;
  private readonly rule: AugmentedDeclaration;
  private nodes: Map<
    ParserCFGNode<DecisionDFAState, DecisionTransition>,
    number
  >;
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

  private nodeId(node: ParserCFGNode<DecisionDFAState, DecisionTransition>) {
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
    return expr;
  }

  renderDecision(expr: DecisionTransition, first = false): string {
    /*if (expr instanceof DecisionOr) {
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
    }*/
    if (expr instanceof DecisionReturn) {
      return `(return ${expr.option})`;
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
            this.rule.type === "token"
          )}*/`
        : ""
    }`;
  }

  private renderFollowInfo(id: number) {
    const info = this.grammar.follows.getById(id);
    return `${id}${this.DEBUG ? ` /* ${info.rule} ${info.exitState.id} */` : ""}`;
  }

  private renderFollowCondition(test: DecisionTestFollow) {
    const { ff, from, to } = test;
    this.markVar("$ff" + ff);
    return from === to
      ? `$ff${ff} === ${this.renderFollowInfo(from)}`
      : `${from} <= $ff${ff} && $ff${ff} <= ${to}`;
  }

  private renderRangeCondition(test: DecisionTestToken) {
    const { ll, from, to } = test;
    this.markVar("$ll" + ll);
    return from === to
      ? `$ll${ll} === ${this.renderNum(from)}`
      : `${this.renderNum(from)} <= $ll${ll} && $ll${ll} <= ${this.renderNum(
          to
        )}`;
  }

  renderExpectBlock(
    indent: string,
    block: ExpectBlock<DecisionTransition> | ReturnBlock<DecisionTransition>
  ): string {
    return `${indent}${this.renderDecision(block.transition)};`;
  }

  private r(
    indent: string,
    block: CodeBlock<DecisionDFAState, DecisionTransition>
  ): string {
    switch (block.type) {
      case "expect_block":
      case "return_block":
        return this.renderExpectBlock(indent, block);
      case "seq_block":
        return (
          "(and" + block.blocks.map(b => this.r(indent, b)).join(" && ") + ")"
        );
      case "decision_block":
        return (
          "(or" +
          block.choices
            .map(([transition, innerBlock]) => this.r(indent, innerBlock))
            .join(" || ") +
          ")"
        );
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

  process(
    indent: string,
    block: CodeBlock<DecisionDFAState, DecisionTransition>
  ) {
    const rendered = this.r(`${indent}  `, block);
    const vars = [...Array.from(this.internalVars)].filter(Boolean);
    const decls = vars.length > 0 ? `\n${indent}  let ${vars.join(", ")};` : "";
    return `${decls}\n${rendered}\n${indent}`;
  }
}

// Very experimental, complex, and probably not needed
export function minimizeDecision(
  grammar: Grammar,
  analyzer: Analyzer,
  rule: AugmentedDeclaration,
  decision: DecisionExpr
) {
  const nfaToDfa = new DecisionNfaToDfa();
  const dfaMinimizer = new DecisionDfaMinimizer();

  const frag = FactoryDecisionExpr.process(decision, 0);
  const automaton = dfaMinimizer.minimize(
    nfaToDfa.do({
      start: frag.start,
      acceptingSet: new Set([frag.end]),
    })
  );

  const block = new CfgToCode<DecisionDFAState, DecisionTransition>().process(
    automaton
  );
  const code = new DecisionGenerator(grammar, analyzer, rule).process(
    "  ",
    block
  );
  return code;
}
