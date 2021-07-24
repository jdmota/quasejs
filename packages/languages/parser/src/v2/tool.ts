import { Analyzer, AnalyzerFollow } from "./analysis/analysis";
import { Automaton, Frag } from "./automaton/automaton";
import { DState } from "./automaton/state";
import { FactoryRule } from "./factories/factory-rule";
import { FactoryToken } from "./factories/factory-token";
import { CfgToCode, CodeBlock } from "./generators/dfa-to-code/cfg-to-code";
import { ParserGenerator } from "./generators/generate-parser";
import { createGrammar } from "./grammar/grammar";
import {
  Declaration,
  RuleDeclaration,
  TokenDeclaration,
  TokenRules,
} from "./grammar/grammar-builder";
import { GrammarTypesInfer } from "./grammar/grammar-infer2";
import { DFA } from "./optimizer/abstract-optimizer";
import { DfaMinimizer, NfaToDfa } from "./optimizer/optimizer";

type ToolInput = {
  readonly name: string;
  readonly ruleDecls: readonly RuleDeclaration[];
  readonly tokenDecls: readonly TokenDeclaration[];
};

export function tool(opts: ToolInput) {
  const result = createGrammar(opts.name, opts.ruleDecls, opts.tokenDecls);

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

  // Process rule declarations
  const ruleAutomatons = new Map<RuleDeclaration, DFA<DState>>();
  for (const rule of grammar.getRules()) {
    const frag = FactoryRule.process(grammar, rule, rulesAutomaton);
    const automaton = minimize(rule.name, frag);
    ruleAutomatons.set(rule, automaton);
    initialStates.set(rule.name, automaton.start);
  }

  // Process tokens
  const tokenAutomatons = new Map<TokenDeclaration, DFA<DState>>();
  for (const token of grammar.getTokens()) {
    const frag = FactoryToken.process(grammar, token, tokensAutomaton);
    const automaton = minimize(token.name, frag);
    tokenAutomatons.set(token, automaton);
    initialStates.set(token.name, automaton.start);
  }

  // Init analyzer
  const analyzer = new Analyzer({
    initialStates,
    follows,
  });

  // Create code blocks for tokens
  const tokenCodeBlocks = new Map<TokenDeclaration, CodeBlock>();
  for (const [token, automaton] of tokenAutomatons) {
    tokenCodeBlocks.set(token, new CfgToCode().process(automaton));
  }

  // Produce code for tokens
  const tokenCode = new Map<TokenDeclaration, string>();
  for (const [rule, block] of tokenCodeBlocks) {
    tokenCode.set(
      rule,
      new ParserGenerator(grammar, analyzer, rule).process(block)
    );
  }

  // Create code blocks for rules
  const ruleCodeBlocks = new Map<RuleDeclaration, CodeBlock>();
  for (const [rule, automaton] of ruleAutomatons) {
    ruleCodeBlocks.set(rule, new CfgToCode().process(automaton));
  }

  // Produce code for rules
  const ruleCode = new Map<RuleDeclaration, string>();
  for (const [rule, block] of ruleCodeBlocks) {
    ruleCode.set(
      rule,
      new ParserGenerator(grammar, analyzer, rule).process(block)
    );
  }

  const infer = new GrammarTypesInfer(grammar);
  for (const rule of grammar.getRules()) {
    infer.run(rule);
  }
  infer.debug();

  return { tokenCode, ruleCode };
}
