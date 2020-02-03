import Grammar, { Options } from "./grammar";
import { Factory } from "./factory";
import { NfaToDfa, DfaMinimizer } from "./optimizer";
import { Analyser } from "./analysis";
import { ParserRule, LexerRule } from "./parser/grammar-parser";
import { DFA } from "./abstract-optimizer";
import { DState } from "./state";
import { CodeGenerator } from "./code-gen";
import { Frag } from "./automaton";

export default function(grammarText: string, options?: Options) {
  // Init

  const grammar = new Grammar(grammarText, options);

  const parserRulesFactory = new Factory(grammar, false);
  const lexerRulesFactory = new Factory(grammar, true);

  const parserRuleToAutomaton: Map<ParserRule, DFA<DState>> = new Map();
  const lexerRuleToAutomaton: Map<LexerRule, DFA<DState>> = new Map();

  const nfaToDfa = new NfaToDfa();
  const dfaMinimzer = new DfaMinimizer();

  function minimize(frag: Frag) {
    return dfaMinimzer.minimize(
      nfaToDfa.do({
        start: frag.in,
        acceptingSet: new Set([frag.out]),
      })
    );
  }

  const analyzerOpts = {
    initialStates: new Map(),
    finalStates: new Map(),
    follows: dfaMinimzer.follows,
  };
  const analyser = new Analyser(analyzerOpts);

  // Create automaton for each rule and safe information about each

  function handleRule(frag: Frag, rule: ParserRule | LexerRule) {
    const minimized = minimize(frag);

    analyzerOpts.initialStates.set(rule, minimized.start);
    for (const state of minimized.acceptingSet) {
      analyzerOpts.finalStates.set(state, rule);
    }
    return minimized;
  }

  for (const rule of grammar.parserRules.values()) {
    const frag = parserRulesFactory.ParserRule(rule);
    parserRuleToAutomaton.set(rule, handleRule(frag, rule));
  }

  for (const rule of grammar.lexerRules.values()) {
    const frag = lexerRulesFactory.LexerRule(rule);
    lexerRuleToAutomaton.set(rule, handleRule(frag, rule));
  }

  // Create main lexer automaton

  const lexerAutomaton = minimize(lexerRulesFactory.genLexer(grammar.nodeToId));
  for (const state of lexerAutomaton.acceptingSet) {
    analyzerOpts.finalStates.set(state, null);
  }

  // Generate code

  const codeGen = new CodeGenerator(grammar, analyser);

  return {
    code: codeGen.gen(
      parserRuleToAutomaton,
      lexerRuleToAutomaton,
      lexerAutomaton
    ),
    conflicts: analyser.conflicts,
  };
}
