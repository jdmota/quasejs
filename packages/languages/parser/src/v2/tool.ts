import { Analyzer, AnalyzerFollow } from "./analysis/analysis";
import { Automaton, Frag } from "./automaton/automaton";
import { DState } from "./automaton/state";
import { FactoryRule } from "./factories/factory-rule";
import { FactoryToken } from "./factories/factory-token";
import { CfgToCode, CodeBlock } from "./generators/dfa-to-code/cfg-to-code";
import { CodeToString } from "./generators/generate-parser";
import { createGrammar } from "./grammar/grammar";
import { Declaration } from "./grammar/grammar-builder";
import { DFA } from "./optimizer/abstract-optimizer";
import { DfaMinimizer, NfaToDfa } from "./optimizer/optimizer";

type ToolInput = {
  readonly name: string;
  readonly decls: readonly Declaration[];
};

export function tool(opts: ToolInput) {
  const result = createGrammar(opts.name, opts.decls);

  if (result.errors) {
    for (const error of result.errors) {
      console.error(`Error in grammar ${opts.name}: ${error}`);
    }
    return null;
  }

  const grammar = result.grammar;
  const rulesAutomaton = new Automaton();
  const tokensAutomaton = new Automaton();

  // Init information the analyzer will need
  const initialStates = new Map<string, DState>();
  const follows = new Map<string, AnalyzerFollow[]>();

  // Init minimizers
  const nfaToDfa = new NfaToDfa();
  const dfaMinimizer = new DfaMinimizer(follows);

  function minimize(ruleName: string, frag: Frag) {
    dfaMinimizer.setCurrentRule(ruleName);
    return dfaMinimizer.minimize(
      nfaToDfa.do({
        start: frag.start,
        acceptingSet: new Set([frag.end]),
      })
    );
  }

  // Process declarations
  const automatons = new Map<string, DFA<DState>>();
  const tokenFrags: Frag[] = [];

  for (const rule of grammar.getRules()) {
    const frag = FactoryRule.process(grammar, rule, rulesAutomaton);
    const automaton = minimize(rule.name, frag);
    automatons.set(rule.name, automaton);
    initialStates.set(rule.name, automaton.start);
  }

  for (const [name, token] of grammar.getTokens()) {
    const frag = FactoryToken.process(grammar, token, tokensAutomaton);
    const automaton = minimize(name, frag);
    automatons.set(name, automaton);
    initialStates.set(name, automaton.start);
    tokenFrags.push(frag);
  }

  // Lexer
  automatons.set(
    "#lexer",
    minimize("#lexer", tokensAutomaton.choice(tokenFrags))
  );

  // Init analyzer
  const analyzer = new Analyzer({
    startRule: grammar.getStart().name,
    initialStates,
    follows,
  });

  // Create code blocks
  const codeBlocks = new Map<string, CodeBlock>();
  for (const [name, automaton] of automatons) {
    codeBlocks.set(name, new CfgToCode().process(automaton));
  }

  // Produce code
  const code = new Map<string, string>();
  for (const [name, block] of codeBlocks) {
    code.set(name, CodeToString.render("", block));
  }

  return code;
}
