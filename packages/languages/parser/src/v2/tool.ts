import { Analyzer, AnalyzerFollow } from "./analysis/analysis";
import { Automaton, Frag } from "./automaton/automaton";
import { DState } from "./automaton/state";
import { FactoryRule } from "./factories/factory-rule";
import { CfgToCode, CodeBlock } from "./generators/dfa-to-code/cfg-to-code";
import { CodeToString } from "./generators/generate-parser";
import { Grammar } from "./grammar/grammar";
import { RuleDeclaration } from "./grammar/grammar-builder";
import { typecheck } from "./grammar/grammar-checker";
import { DFA } from "./optimizer/abstract-optimizer";
import { DfaMinimizer, NfaToDfa } from "./optimizer/optimizer";

type ToolInput = {
  readonly name: string;
  readonly rules: readonly RuleDeclaration[];
};

export function tool(opts: ToolInput) {
  // Init grammar
  const grammar = new Grammar(opts.name, opts.rules);

  // Perform some checks
  const { errors, warnings } = typecheck(grammar);

  for (const error of errors) {
    console.error(`Error in grammar ${grammar.name}: ${error}`);
  }

  for (const warning of warnings) {
    console.error(`Warning in grammar ${grammar.name}: ${warning}`);
  }

  if (errors.length > 0) {
    return null;
  }

  // Init factory
  const ruleFactory = new FactoryRule();

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
        start: frag.in,
        acceptingSet: new Set([frag.out]),
      })
    );
  }

  // Process rules
  const automatons = new Map<string, DFA<DState>>();
  for (const [name, rule] of grammar.rules) {
    const automaton = minimize(name, ruleFactory.genRule(rule));
    automatons.set(name, automaton);
    initialStates.set(name, automaton.start);
  }

  // Init analyzer
  const analyzer = new Analyzer({
    startRule: grammar.startRule.name,
    initialStates,
    follows,
  });

  // Create code blocks
  const cfgToCode = new CfgToCode();
  const codeBlocks = new Map<string, CodeBlock>();
  for (const [name, automaton] of automatons) {
    codeBlocks.set(name, cfgToCode.process(automaton));
  }

  // Produce code
  const codeToString = new CodeToString();
  const code = new Map<string, string>();
  for (const [name, block] of codeBlocks) {
    code.set(name, codeToString.render("", block));
  }

  return code;
}
