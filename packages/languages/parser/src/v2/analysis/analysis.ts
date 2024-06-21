import { DState } from "../automaton/state.ts";
import { assertion, nonNull, setAdd } from "../utils/index.ts";
import { ParserGenerator } from "../generators/generate-parser.ts";
import { AugmentedDeclaration, Grammar } from "../grammar/grammar.ts";
import { FollowInfoDB } from "../grammar/follow-info.ts";
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

export class Analyzer implements IAnalyzer<AnalysisPoint> {
  readonly grammar: Grammar;
  readonly follows: FollowInfoDB;
  readonly initialStates: Map<RuleName, DState>;
  private llState: number;

  constructor({
    grammar,
    initialStates,
  }: {
    grammar: Grammar;
    initialStates: Map<RuleName, DState>;
  }) {
    this.grammar = grammar;
    this.follows = grammar.follows;
    this.initialStates = initialStates;
    this.llState = 0;
  }

  getLLState() {
    return this.llState;
  }

  // TODO what about the follow of $lexer?
  // TODO what about left recursive rules?

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

    const gllAnalyzers = new Map<AnyTransition, AnalysisGLL>();
    const initialGSSs = new Map<AnyTransition, GSSNode<StateInRule>>();
    const allFollows = new Map<AnyTransition, FollowStack[]>();

    for (const [goto, dest] of state) {
      const a = new AnalysisGLL(this, ll1, rule.name, state, goto);
      gllAnalyzers.set(goto, a);
      initialGSSs.set(goto, a.getInitialGSS());
      a.addInitial(1);
      a.run();
    }

    let prev: readonly DecisionTreeNoAdd<AnalysisPoint>[] = [
      ll1.ensureDecisions(Array.from(state.transitions())),
    ];
    let next: DecisionTreeNoAdd<AnalysisPoint>[] = [];

    this.llState = 2;

    let followIndex = 1;

    while (prev.length) {
      const inLLAnalysis = this.llState <= maxLL;
      const inFFAnalysis = followIndex <= maxFF;

      if (
        !inLLAnalysis &&
        inFFAnalysis &&
        followIndex === 1 &&
        allFollows.size === 0
      ) {
        for (const [goto, node] of initialGSSs) {
          // TODO this over-approximates (compare with reference result of "endAux" or "GLLAuxOptional1")
          allFollows.set(
            goto,
            buildFollow(this, node, maxFF, nonNull(gllAnalyzers.get(goto)))
          );
        }
      }

      for (const tree of prev) {
        assertion(tree.hasDecisions());
        for (const decision of tree.iterate()) {
          if (DEBUG.keepGoing || decision.isAmbiguous()) {
            if (inLLAnalysis) {
              const nextTree = decision.ensureNextTokenTree();
              assertion(nextTree.ll === this.llState);
              for (const { desc, gotos } of decision) {
                if (desc) {
                  const a = new AnalysisGLL(
                    this,
                    ll1,
                    rule.name,
                    state,
                    desc.label.goto
                  );
                  a.setTree(nextTree, gotos);
                  a.doContinue(desc);
                } else {
                  nextTree.addEof(gotos);
                }
              }
              next.push(nextTree.ensureDecisions(decision.getGotos()));
            } else if (inFFAnalysis) {
              const nextTree = decision.ensureNextFollowTree();
              assertion(nextTree.ff === followIndex);
              for (const { desc, gotos } of decision) {
                if (desc) {
                  const follows = nonNull(allFollows.get(desc.label.goto));
                  for (const follow of follows) {
                    nextTree.addDecision(
                      rule.name,
                      this.follows,
                      getInFollowStack(follow, followIndex),
                      [desc.label.goto],
                      desc
                    );
                  }
                  if (follows.length === 0) {
                    nextTree.addEof(gotos);
                  }
                } else {
                  nextTree.addEof(gotos);
                }
              }
              next.push(nextTree.ensureDecisions(decision.getGotos()));
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

  printAmbiguities(
    rule: AugmentedDeclaration,
    state: DState,
    maxLL: number,
    inverted: InvertedDecisionTree<AnalysisPoint>
  ) {
    const { ambiguities } = inverted;
    if (ambiguities.length === 0) {
      return;
    }
    const gen = new ParserGenerator(this.grammar, this, rule);
    console.log("-----------");
    console.log(
      `Ambiguities in rule ${rule.name}, state ${state.id}, ll = ${maxLL}`
    );
    for (const { decision, condition } of ambiguities) {
      console.log(
        `Condition ${gen.renderDecision(
          condition,
          true
        )} is not enough to choose between:`
      );
      for (const goto of decision.getGotos()) {
        console.log(
          ` - ${gen.renderExpectBlock("", {
            type: "expect_block",
            transition: goto,
          })}`
        );
      }
    }
    console.log("-----------");
  }
}

function buildFollow(
  analyzer: Analyzer,
  initialGSS: GSSNode<StateInRule>,
  maxFF: number,
  gllAnalyzer: AnalysisGLL
) {
  let prev: {
    n: GSSNode<StateInRule>;
    f: FollowStack | null;
  }[] = [{ n: initialGSS, f: null }];
  let next: {
    n: GSSNode<StateInRule>;
    f: FollowStack | null;
  }[] = [];
  const follows: FollowStack[] = [];

  while (prev.length) {
    for (const { n, f } of prev) {
      if ((f?.size ?? 0) >= maxFF) {
        follows.push(nonNull(f));
      } else {
        if (n.hasChildren()) {
          for (const [l, set] of n.children()) {
            for (const c of set) {
              next.push({
                n: c,
                f: new FollowStack(
                  analyzer,
                  f,
                  analyzer.follows.getByRuleExitState(l.rule, l.state).id
                ),
              });
            }
          }
        } else {
          const follow = analyzer.follows.get(n.rule);
          for (const info of follow) {
            next.push({
              n: gllAnalyzer.ensureGLLNode(info.rule, 0),
              f: new FollowStack(analyzer, f, info.id),
            });
          }
          if (follow.length === 0) {
            if (f) follows.push(f);
          }
        }
      }
    }
    prev = next;
    next = [];
  }

  return follows;
}
