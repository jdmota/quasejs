import { DState } from "../automaton/state.ts";
import { assertion, first, nonNull } from "../../util/miscellaneous.ts";
import { type AugmentedDeclaration, Grammar } from "../grammar/grammar.ts";
import {
  DecisionTokenTree,
  InvertedDecisionTree,
  type DecisionTreeNoAdd,
} from "./decision-trees.ts";
import { getInFollowStack } from "./decision-expr.ts";
import { DEBUG, DEBUG_apply, DEBUG_unapply } from "./analysis-debug.ts";
import { FollowStack } from "./follow-stack.ts";
import {
  AnalysisGLL,
  AnalysisGLLArgs,
  type AnalysisGSSNode,
  type AnalysisPoint,
} from "./analysis-gll.ts";
import { GSSNode } from "../gll/gll-base.ts";
import { IAnalyzer } from "./analysis-reference.ts";
import { type AnyTransition } from "../automaton/transitions.ts";
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

  analyze(rule: AugmentedDeclaration, state: DState) {
    const inCache = this.cache.get(state);
    if (inCache) return inCache;

    let maxLL, maxFF;
    if (rule.name === LEXER_RULE_NAME) {
      maxLL = 1;
      maxFF = 0;
    } else {
      maxLL = this.grammar.maxLL;
      maxFF = this.grammar.maxFF;
    }

    DEBUG_apply(rule);
    this.currentRule = rule;

    // Reset phase
    this.llState = 0;

    const ll1 = new DecisionTokenTree<AnalysisPoint>(null);
    const inverted = new InvertedDecisionTree<AnalysisPoint>();

    this.llState = 1;

    const initialGSSs = new Map<AnyTransition, AnalysisGSSNode>();

    for (const [goto, dest] of state) {
      const a = new AnalysisGLL(this, ll1, goto, rule.name, state);
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
                // "gotos.size === 1" occurs because nodes from the initial GLL analyzers are considered different
                // this is actually what we want, to avoid confusion and preserve soundness
                // the example rule GLL1Follow2 is a regression test
                assertion(gotos.size === 1);
                const a = new AnalysisGLL(
                  this,
                  nextTree,
                  first(gotos),
                  rule.name,
                  state
                );
                a.doContinue(desc);
              }
              next.push(nextTree);
            } else if (inFFAnalysis) {
              const nextTree = decision.ensureNextFollowTree();
              assertion(nextTree.ff === followIndex);
              for (const { desc, gotos } of decision) {
                assertion(gotos.size === 1);
                const goto = first(gotos);
                let follows = followsCache.get(desc);
                if (!follows) {
                  follows = buildFollow(
                    this,
                    nonNull(initialGSSs.get(goto)),
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
                    [goto],
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

function* gssChildren(
  analyzer: Analyzer,
  node: AnalysisGSSNode
): Generator<readonly [number, AnalysisGSSNode], void, unknown> {
  assertion(node.level === 0);
  if (node.hasChildren()) {
    for (const [{ label }, set] of node.children()) {
      for (const c of set) {
        yield [
          analyzer.follows.getByRuleExitState(label.rule, label.state).id,
          c,
        ] as const;
      }
    }
  } else {
    const follow = analyzer.follows.get(node.rule);
    for (const info of follow) {
      yield [
        info.id,
        new GSSNode(info.rule, AnalysisGLLArgs.SINGLETON, 0),
      ] as const;
    }
    if (follow.length === 0) {
      yield [-1, new GSSNode("$", AnalysisGLLArgs.SINGLETON, 0)] as const;
    }
  }
}

function lookforZeros(start: AnalysisGSSNode) {
  const found = new Set<string>();
  let prev: AnalysisGSSNode[] = [start];
  let next: AnalysisGSSNode[] = [];
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
  start: AnalysisGSSNode,
  goal: Set<string>
) {
  if (goal.has(start.rule)) {
    return true;
  }
  let prev: AnalysisGSSNode[] = [start];
  let next: AnalysisGSSNode[] = [];
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
  initialGSS: AnalysisGSSNode,
  destinationGSS: AnalysisGSSNode,
  maxFF: number
) {
  // assertion(initialGSS.level === 0);
  const zeros = lookforZeros(destinationGSS);
  let prev: {
    n: AnalysisGSSNode;
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
    n: AnalysisGSSNode;
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
