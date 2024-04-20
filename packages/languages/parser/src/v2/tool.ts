import { Analyzer } from "./analysis/analysis.ts";
import { Automaton, Frag } from "./automaton/automaton.ts";
import { DState } from "./automaton/state.ts";
import { FactoryRule } from "./factories/factory-rule.ts";
import { FactoryToken } from "./factories/factory-token.ts";
import { CfgToCode, CodeBlock } from "./generators/dfa-to-code/cfg-to-code.ts";
import { ParserGenerator } from "./generators/generate-parser.ts";
import {
  AugmentedRuleDeclaration,
  AugmentedTokenDeclaration,
  createGrammar,
  Grammar,
} from "./grammar/grammar.ts";
import {
  RuleDeclaration,
  TokenDeclaration,
} from "./grammar/grammar-builder.ts";
import { DFA } from "./optimizer/abstract-optimizer.ts";
import { DfaMinimizer, NfaToDfa } from "./optimizer/optimizer.ts";
import { locSuffix } from "./utils/index.ts";
import { generateAll } from "./generators/generate-all.ts";
import { FollowInfoDB } from "./grammar/follow-info.ts";
import { GType, typeBuilder } from "./grammar/type-checker/types-builder.ts";
import { TypesInferrer } from "./grammar/type-checker/inferrer.ts";
import { runtimeTypes } from "./grammar/type-checker/default-types.ts";
import { typeFormatter } from "./grammar/type-checker/types-formatter.ts";

export type ToolInput = {
  readonly name: string;
  readonly ruleDecls?: readonly RuleDeclaration[];
  readonly tokenDecls?: readonly TokenDeclaration[];
  readonly startArguments?: readonly GType[];
  readonly externalFuncReturns?: Readonly<Record<string, GType>>;
};

export function tool(opts: ToolInput) {
  const result = createGrammar(opts);

  if (result.errors) {
    for (const { message, loc } of result.errors) {
      console.error(message, locSuffix(loc));
    }
    return null;
  }

  const grammar = result.grammar;
  const rulesAutomaton = new Automaton();
  const tokensAutomaton = new Automaton();

  // Init information the analyzer will need
  const initialStates = new Map<string, DState>();
  const follows = new FollowInfoDB();

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
  const ruleAutomatons = new Map<AugmentedRuleDeclaration, DFA<DState>>();
  for (const rule of grammar.getRules()) {
    const frag = FactoryRule.process(grammar, rule, rulesAutomaton);
    const automaton = minimize(rule.name, frag);
    ruleAutomatons.set(rule, automaton);
    initialStates.set(rule.name, automaton.start);
  }

  // Process tokens
  const tokenAutomatons = new Map<AugmentedTokenDeclaration, DFA<DState>>();
  for (const token of grammar.getTokens()) {
    const frag = FactoryToken.process(grammar, token, tokensAutomaton);
    const automaton = minimize(token.name, frag);
    tokenAutomatons.set(token, automaton);
    initialStates.set(token.name, automaton.start);
  }

  // Init analyzer
  const analyzer = new Analyzer({
    grammar,
    initialStates,
    follows,
  });

  // Create code blocks for tokens
  const tokenCodeBlocks = new Map<AugmentedTokenDeclaration, CodeBlock>();
  for (const [token, automaton] of tokenAutomatons) {
    tokenCodeBlocks.set(token, new CfgToCode().process(automaton));
  }

  // Produce code for tokens
  const tokenCode = new Map<AugmentedTokenDeclaration, string>();
  for (const [rule, block] of tokenCodeBlocks) {
    tokenCode.set(
      rule,
      new ParserGenerator(grammar, analyzer, rule).process("  ", block)
    );
  }

  // Create code blocks for rules
  const ruleCodeBlocks = new Map<AugmentedRuleDeclaration, CodeBlock>();
  for (const [rule, automaton] of ruleAutomatons) {
    ruleCodeBlocks.set(rule, new CfgToCode().process(automaton));
  }

  // Produce code for rules
  const ruleCode = new Map<AugmentedRuleDeclaration, string>();
  for (const [rule, block] of ruleCodeBlocks) {
    ruleCode.set(
      rule,
      new ParserGenerator(grammar, analyzer, rule).process("  ", block)
    );
  }

  return { code: generateAll(grammar, tokenCode, ruleCode), grammar };
}

export function inferAndCheckTypes(grammar: Grammar) {
  const inferrer = new TypesInferrer(grammar);

  const knownNames = new Map();
  const typeDeclarations: [string, string][] = [];

  for (const [name, type] of Object.entries(runtimeTypes)) {
    const { typescript, eq } = typeFormatter(type, knownNames);
    typeDeclarations.push(...eq);
    typeDeclarations.push([name, typescript]);
    knownNames.set(type, name);
  }

  {
    const astType = inferrer.declaration(
      grammar.startRule,
      grammar.startArguments
    );
    const { typescript, eq } = typeFormatter(astType, knownNames);
    typeDeclarations.push(...eq);
    typeDeclarations.push(["$AST", typescript]);
  }

  {
    const externalsType = typeBuilder.readObject(
      Object.fromEntries(
        Object.keys(grammar.externalFuncReturns).map(name => [
          name,
          inferrer.getExternalCallType(name),
        ])
      )
    );
    const { typescript, eq } = typeFormatter(externalsType, knownNames);
    typeDeclarations.push(...eq);
    typeDeclarations.push(["$Externals", typescript]);
  }

  const argTypes = grammar.startArguments.map(t => {
    const { typescript, eq } = typeFormatter(t, knownNames);
    typeDeclarations.push(...eq);
    return typescript;
  });

  if (inferrer.errors.length) {
    for (const { message, loc } of inferrer.errors) {
      console.error(message, locSuffix(loc));
    }
  }

  return {
    types: `${typeDeclarations
      .map(([name, type]) => `type ${name} = ${type};`)
      .join("\n")}\nexport function parse(external: $Externals, ${[
      "string: string",
      ...grammar.startRule.args.map((a, i) => `$${a.arg}: ${argTypes[i]}`),
    ].join(", ")}): $AST;\n`,
  };
}
