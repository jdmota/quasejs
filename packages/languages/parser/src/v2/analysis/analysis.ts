import { DState } from "../automaton/state.ts";
import { assertion } from "../utils/index.ts";
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
import { GLLDescriptor, GSSNode } from "../gll/gll-base.ts";
import { IAnalyzer } from "./analysis-reference.ts";

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

  analyze(rule: AugmentedDeclaration, state: DState, maxLL = 3, maxFF = 3) {
    const inCache = this.cache.get(state);
    if (inCache) return inCache;

    DEBUG_apply(rule);
    this.currentRule = rule;

    // Reset phase
    this.llState = 0;

    const ll1 = new DecisionTokenTree<AnalysisPoint>(null);
    const inverted = new InvertedDecisionTree<AnalysisPoint>();

    this.llState = 1;

    for (const [goto, dest] of state) {
      const a = new AnalysisGLL(this, ll1, rule.name, state, goto);
      a.addInitial(1);
      a.run();
    }

    let prev: readonly DecisionTreeNoAdd<AnalysisPoint>[] = [ll1];
    let next: DecisionTreeNoAdd<AnalysisPoint>[] = [];

    this.llState = 2;

    let followIndex = 1;

    while (prev.length) {
      const inLLAnalysis = this.llState <= maxLL;
      const inFFAnalysis = followIndex <= maxFF;

      for (const tree of prev) {
        if (tree.hasDecisions()) {
          for (const decision of tree.iterate()) {
            if (DEBUG.keepGoing || decision.isAmbiguous()) {
              if (inLLAnalysis) {
                const nextTree = decision.ensureNextTokenTree();
                assertion(nextTree.ll === this.llState);
                for (const { desc, gotos } of decision) {
                  /*const a = new AnalysisGLL(this, [], nextTree);
                  a.setGotos(gotos, nextTree);
                  a.doContinue(desc);*/
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
                let hasUsefulFollows = false;
                const nextTree = decision.ensureNextFollowTree();
                assertion(nextTree.ff === followIndex);
                for (const { desc, gotos } of decision) {
                  //const B = buildFollow(this, desc);
                  //const F = followToArray(desc.label.follow);
                  //debugger;

                  const follow = desc.label.follow;
                  if (follow && followIndex <= follow.size) {
                    nextTree.addDecision(
                      rule.name,
                      this.follows,
                      getInFollowStack(follow, followIndex),
                      gotos,
                      desc
                    );
                    hasUsefulFollows = true;
                  } else {
                    nextTree.addDecision(
                      rule.name,
                      this.follows,
                      null,
                      gotos,
                      desc
                    );
                  }
                }
                if (hasUsefulFollows) {
                  next.push(nextTree);
                } else {
                  inverted.add(decision);
                }
              } else {
                inverted.add(decision);
              }
            } else {
              inverted.add(decision);
            }
          }
        } else {
          // If we reached the "end" of the grammar, we do not want to lose the last decision tree
          if (tree.owner) {
            inverted.add(tree.owner);
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

function buildFollow(analyzer: Analyzer, desc: GLLDescriptor<StateInRule>) {
  let prev: { n: GSSNode<StateInRule>; f: string[] }[] = [
    { n: desc.node, f: [] },
  ];
  let next: { n: GSSNode<StateInRule>; f: string[] }[] = [];
  let end = [];
  let seen = new Set();

  while (prev.length) {
    for (const { n, f } of prev) {
      if (seen.has(n)) {
        end.push(f);
        continue;
      }
      seen.add(n);
      //
      let hasChildren = false;
      for (const [l, set] of n.children()) {
        hasChildren = true;
        for (const c of set) {
          next.push({
            n: c,
            f: [...f, l.rule + "-" + n.level],
          });
        }
      }
      if (!hasChildren) {
        end.push(f);
      }
    }
    prev = next;
    next = [];
  }

  return end;
}

function followToArray(follow: FollowStack | null) {
  let f: FollowStack | null = follow;
  let array = [];
  while (f) {
    array.push(f.info.rule);
    f = f.child;
  }
  return array;
}
