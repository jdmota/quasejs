import { DState } from "../automaton/state.ts";
import { assertion, nonNull } from "../../../../util/miscellaneous.ts";
import { AugmentedDeclaration, Grammar } from "../grammar/grammar.ts";
import {
  DecisionTokenTree,
  DecisionTreeNoAdd,
  InvertedDecisionTree,
} from "./decision-trees.ts";
import { getInFollowStack } from "./decision-expr.ts";
import { DEBUG, DEBUG_apply, DEBUG_unapply } from "./analysis-debug.ts";
import { FollowStack } from "./follow-stack.ts";
import { AnalysisGLL, AnalysisPoint, StateInRule } from "./analysis-gll.ts";
import { GSSNode } from "../gll/gll-base.ts";
import { IAnalyzer } from "./analysis-reference.ts";
import { AnyTransition } from "../automaton/transitions.ts";
import { ANY_CHAR_RANGE } from "../constants.ts";
import { LEXER_RULE_NAME } from "../grammar/tokens.ts";

type RuleName = string;

export class Analyzer extends IAnalyzer<AnalysisPoint> {
  private llState: number;

  constructor({
    grammar,
    initialStates,
  }: {
    grammar: Grammar;
    initialStates: ReadonlyMap<RuleName, DState>;
  }) {
    super({
      grammar,
      initialStates,
    });
    this.llState = 0;
  }

  getLLState() {
    return this.llState;
  }

  // TODO deal with left recursive rules transformation!

  /*
  E[1] -> E[2] ( + E[2] | - E[2] )* // left assoc
  E[2] -> E[3] ( ** E[2] )? // right assoc
  E[3] -> - E[3] | E[4]
  E[4] -> num | ( E[1] )

  E -> E + E
       E - E
       E ** E
       - E
       ( E )
       num

  E -> E prec(+,1) E
       E prec(-,1) E
       E prec(**,2,right) E
       prec(-,3) E
       ( E )
       num

  // https://tree-sitter.github.io/tree-sitter/creating-parsers#using-precedence

  E -> prec.left(1, E + E)
       prec.left(1, E - E)
       prec.right(2, E ** E)
       prec(3, - E)
       ( E )
       num

  // If precedences are equal, then associativity is used
  */

  private readonly cache = new WeakMap<
    DState,
    {
      tree: DecisionTokenTree<AnalysisPoint>;
      inverted: InvertedDecisionTree<AnalysisPoint>;
    }
  >();

  public currentRule: AugmentedDeclaration = null as any;

  getAnyRange() {
    return this.currentRule.type === "rule"
      ? this.grammar.tokens.anyRange()
      : ANY_CHAR_RANGE;
  }

  analyze(rule: AugmentedDeclaration, state: DState, maxLL = 3, maxFF = 3) {
    const inCache = this.cache.get(state);
    if (inCache) return inCache;

    if (rule.name === LEXER_RULE_NAME) {
      maxLL = 1;
      maxFF = 0;
    }

    DEBUG_apply(rule);
    this.currentRule = rule;

    // Reset phase
    this.llState = 0;

    const ll1 = new DecisionTokenTree<AnalysisPoint>(null);
    const inverted = new InvertedDecisionTree<AnalysisPoint>();

    this.llState = 1;

    // const gllAnalyzers = new Map<AnyTransition, AnalysisGLL>();
    const initialGSSs = new Map<AnyTransition, GSSNode<StateInRule>>();

    for (const [goto, dest] of state) {
      const a = new AnalysisGLL(this, ll1, rule.name, state, goto);
      // gllAnalyzers.set(goto, a);
      initialGSSs.set(goto, a.getInitialGSS());
      a.addInitial(1);
      a.run();
    }

    let prev: readonly DecisionTreeNoAdd<AnalysisPoint>[] = [ll1];
    let next: DecisionTreeNoAdd<AnalysisPoint>[] = [];

    this.llState = 2;

    let followIndex = 1;

    const followsCache = new WeakMap();

    while (prev.length) {
      const inLLAnalysis = this.llState <= maxLL;
      const inFFAnalysis = followIndex <= maxFF;

      for (const tree of prev) {
        if (!tree.hasDecisions() && tree.owner) inverted.add(tree.owner);
        if (tree.hasAnyDecisions()) inverted.addAny(tree);
        for (const decision of tree.iterate()) {
          if (DEBUG.keepGoing || decision.isAmbiguous()) {
            if (inLLAnalysis) {
              const nextTree = decision.ensureNextTokenTree();
              assertion(nextTree.ll === this.llState);
              for (const { desc, gotos } of decision) {
                const a = new AnalysisGLL(
                  this,
                  ll1,
                  rule.name,
                  state,
                  desc.label.goto
                );
                a.setTree(nextTree, gotos);
                a.doContinue(desc);
              }
              next.push(nextTree);
            } else if (inFFAnalysis) {
              const nextTree = decision.ensureNextFollowTree();
              assertion(nextTree.ff === followIndex);
              for (const { desc, gotos } of decision) {
                let follows = followsCache.get(desc);
                if (!follows) {
                  follows = buildFollow(
                    this,
                    nonNull(initialGSSs.get(desc.label.goto)),
                    desc.node,
                    maxFF
                  );
                  followsCache.set(desc, follows);
                }
                for (const follow of follows) {
                  nextTree.addDecision(
                    rule.name,
                    this.follows,
                    getInFollowStack(follow, followIndex),
                    [desc.label.goto],
                    desc
                  );
                }
                assertion(follows.length > 0);
              }
              next.push(nextTree);
            } else {
              inverted.add(decision);
            }
          } else {
            inverted.add(decision);
          }
        }
      }
      prev = next;
      next = [];
      if (inLLAnalysis) {
        this.llState++;
      } else if (inFFAnalysis) {
        followIndex++;
      }
    }

    DEBUG_unapply();

    this.printAmbiguities(rule, state, maxLL, inverted);

    const result = {
      tree: ll1,
      inverted,
    };
    this.cache.set(state, result);
    return result;
  }
}

function* gssChildren(analyzer: Analyzer, node: GSSNode<StateInRule>) {
  assertion(node.level === 0);
  if (node.hasChildren()) {
    for (const [l, set] of node.children()) {
      for (const c of set) {
        yield [
          analyzer.follows.getByRuleExitState(l.rule, l.state).id,
          c,
        ] as const;
      }
    }
  } else {
    const follow = analyzer.follows.get(node.rule);
    for (const info of follow) {
      yield [info.id, new GSSNode<StateInRule>(info.rule, 0)] as const;
    }
    if (follow.length === 0) {
      yield [-1, new GSSNode<StateInRule>("$", 0)] as const;
    }
  }
}

function lookforZeros(start: GSSNode<StateInRule>) {
  const found = new Set<string>();
  let prev: GSSNode<StateInRule>[] = [start];
  let next: GSSNode<StateInRule>[] = [];
  const seen = new Set();
  while (prev.length) {
    for (const n of prev) {
      if (n.level === 0) {
        found.add(n.rule);
      } else {
        for (const [l, set] of n.children()) {
          for (const c of set) {
            if (!seen.has(c)) {
              seen.add(c);
              next.push(c);
            }
          }
        }
      }
    }
    prev = next;
    next = [];
  }
  return found;
}

function lookfor(
  analyzer: Analyzer,
  start: GSSNode<StateInRule>,
  goal: Set<string>
) {
  if (goal.has(start.rule)) {
    return true;
  }
  let prev: GSSNode<StateInRule>[] = [start];
  let next: GSSNode<StateInRule>[] = [];
  const seen = new Set<string>();
  while (prev.length) {
    for (const n of prev) {
      for (const [fId, c] of gssChildren(analyzer, n)) {
        if (goal.has(c.rule)) {
          return true;
        }
        if (!seen.has(c.rule)) {
          seen.add(c.rule);
          next.push(c);
        }
      }
    }
    prev = next;
    next = [];
  }
  return false;
}

function buildFollow(
  analyzer: Analyzer,
  initialGSS: GSSNode<StateInRule>,
  destinationGSS: GSSNode<StateInRule>,
  maxFF: number
) {
  assertion(initialGSS.level === 0);
  const zeros = lookforZeros(destinationGSS);
  let prev: {
    n: GSSNode<StateInRule>;
    f: FollowStack | null;
    b: boolean;
  }[] = [
    {
      n: initialGSS,
      f: null,
      b: zeros.has(initialGSS.rule),
    },
  ];
  let next: {
    n: GSSNode<StateInRule>;
    f: FollowStack | null;
    b: boolean;
  }[] = [];
  const follows: FollowStack[] = [];

  while (prev.length) {
    for (const { n, f, b } of prev) {
      if ((f?.size ?? 0) >= maxFF) {
        if (b || lookfor(analyzer, n, zeros)) follows.push(nonNull(f));
      } else {
        for (const [fId, c] of gssChildren(analyzer, n)) {
          next.push({
            n: c,
            f: new FollowStack(analyzer, f, fId),
            b: b || zeros.has(c.rule),
          });
        }
      }
    }
    prev = next;
    next = [];
  }

  return follows;
}
