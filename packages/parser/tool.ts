import { Analyzer } from "./analysis/analysis.ts";
import { AnalyzerReference } from "./analysis/analysis-reference.ts";
import { Automaton, type Frag } from "./automaton/automaton.ts";
import { DState, State } from "./automaton/state.ts";
import { FactoryRule } from "./factories/factory-rule.ts";
import { FactoryToken } from "./factories/factory-token.ts";
import {
  LabelsManager,
  ParserGenerator,
} from "./generators/generate-parser.ts";
import {
  type AugmentedDeclaration,
  createGrammar,
  Grammar,
} from "./grammar/grammar.ts";
import {
  type RuleDeclaration,
  type TokenDeclaration,
} from "./grammar/grammar-builder.ts";
import { type DFA } from "./optimizer/abstract-optimizer.ts";
import { DfaMinimizer, NfaToDfa } from "./optimizer/optimizer.ts";
import { locSuffix } from "./utils/index.ts";
import { generateAll } from "./generators/generate-all.ts";
import {
  type GType,
  typeBuilder,
} from "./grammar/type-checker/types-builder.ts";
import { TypesInferrer } from "./grammar/type-checker/inferrer.ts";
import { runtimeTypes } from "./grammar/type-checker/default-types.ts";
import { typeFormatter } from "./grammar/type-checker/types-formatter.ts";
import { type AnyTransition } from "./automaton/transitions.ts";
import { LEXER_RULE_NAME } from "./grammar/tokens.ts";
import { ParserCfgToCode } from "./generators/parser-cfg-to-code.ts";
import {
  convertDFAtoCFG,
  type ParserCFGNode,
} from "./generators/parser-dfa-to-cfg.ts";
import { setAdd } from "../util/maps-sets.ts";
import { traverse, walkUp } from "../util/graph.ts";
import { nonNull } from "../util/miscellaneous.ts";

// TODO runtime follow stack will not work with gll
// TODO support parallel lexers?

// TODO implement error recovery, and filling the missing tokens
// TODO implement incremental parsings
// TODO left recursion removal https://www.antlr.org/papers/allstar-techreport.pdf

export type ToolInput = Readonly<{
  name: string;
  ruleDecls?: readonly RuleDeclaration[];
  tokenDecls?: readonly TokenDeclaration[];
  startArguments?: readonly GType[];
  externalFuncReturns?: Readonly<Record<string, GType>>;
  maxLL?: number;
  maxFF?: number;
  _useReferenceAnalysis?: boolean;
}>;

export function tool(opts: ToolInput) {
  const result = createGrammar(opts);

  if (result.errors) {
    for (const { message, loc } of result.errors) {
      console.error(message, locSuffix(loc));
    }
    return null;
  }

  const { grammar, referencesGraph } = result;
  const rulesAutomaton = new Automaton();
  const tokensAutomaton = new Automaton();

  // Init information the analyzer will need
  const initialStates = new Map<string, DState>();
  const follows = grammar.follows;

  // Init minimizers
  const nfaToDfa = new NfaToDfa();
  const dfaMinimizer = new DfaMinimizer(follows);

  function minimize(ruleName: string, frag: Frag<State, AnyTransition>) {
    dfaMinimizer.setCurrentRule(ruleName);
    return dfaMinimizer.minimize(
      nfaToDfa.do({
        start: frag.start,
        acceptingSet: new Set([frag.end]),
      })
    );
  }

  const automatons = new Map<AugmentedDeclaration, DFA<DState>>();
  const allFields = new Map<AugmentedDeclaration, Map<string, boolean>>();

  // Process rule declarations
  for (const rule of grammar.getRules()) {
    const fields = new Map<string, boolean>();
    allFields.set(rule, fields);

    const frag = FactoryRule.process(grammar, rule, rulesAutomaton, fields);
    const automaton = minimize(rule.name, frag);
    automatons.set(rule, automaton);
    initialStates.set(rule.name, automaton.start);
  }

  // Process token declarations
  for (const token of grammar.getTokens()) {
    const fields = new Map<string, boolean>();
    allFields.set(token, fields);

    const frag = FactoryToken.process(grammar, token, tokensAutomaton, fields);
    const automaton = minimize(token.name, frag);
    automatons.set(token, automaton);
    initialStates.set(token.name, automaton.start);
    if (token.name === LEXER_RULE_NAME) {
      grammar.follows.addLexerFollow(automaton.start);
    }
  }

  // Init analyzer
  const analyzer = opts._useReferenceAnalysis
    ? new AnalyzerReference({
        grammar,
        initialStates,
      })
    : new Analyzer({
        grammar,
        initialStates,
      });

  // Rules that need GLL
  const needGLL = new Set<string>();

  // Detect rules that need GLL
  for (const [decl, automaton] of automatons) {
    if (needGLL.has(decl.name)) continue;
    for (const state of automaton.states) {
      // The analyzer performs caching, so this is ok
      const { inverted } = analyzer.analyze(decl, state);
      if (inverted.hasAmbiguities()) {
        // Mark this rule and others that use this one as needing GLL
        const it = traverse(referencesGraph.node(decl.name), walkUp);
        for (let step = it.next(); !step.done; ) {
          step = it.next(setAdd(needGLL, step.value.data));
        }
        break;
      }
    }
  }

  const cfgs = new Map<
    AugmentedDeclaration,
    {
      labels: LabelsManager;
      thisCfgs: (readonly [
        Readonly<{ start: ParserCFGNode; nodes: ReadonlySet<ParserCFGNode> }>,
        number,
      ])[];
    }
  >();

  // Produce cfgs from automatons
  for (const [decl, automaton] of automatons) {
    const thisCfgs = [];
    const labels = new LabelsManager(needGLL);
    // Add start
    labels.add(null, automaton.start);
    // Generate all labels for this declaration
    for (const [edge, id] of labels) {
      thisCfgs.push([
        convertDFAtoCFG(
          analyzer,
          needGLL,
          decl,
          labels,
          automaton.acceptingSet,
          edge.transition,
          edge.dest
        ),
        id,
      ] as const);
    }
    cfgs.set(decl, { labels, thisCfgs });
  }

  const tokensCode: string[] = [];
  const rulesCode: string[] = [];

  // Produce code from cfgs
  for (const [decl, { labels, thisCfgs }] of cfgs) {
    const cfgToCode = new ParserCfgToCode();
    const generator = new ParserGenerator(
      grammar,
      analyzer,
      decl,
      labels,
      nonNull(allFields.get(decl))
    );
    for (const [cfg, id] of thisCfgs) {
      const code = generator.process(
        cfgToCode.process(cfg.start, cfg.nodes),
        id
      );
      if (decl.type === "token") {
        tokensCode.push(code);
      } else {
        rulesCode.push(code);
      }
      cfgToCode.reset();
      generator.reset();
    }
  }

  const { forTokens, forRules } = ParserGenerator.genCreateInitialEnvFunc(
    allFields,
    needGLL
  );
  tokensCode.push(forTokens);
  rulesCode.push(forRules);

  return {
    code: generateAll(grammar, tokensCode, rulesCode, needGLL),
    grammar,
  };
}

export function inferAndCheckTypes(grammar: Grammar, needsGLL: boolean) {
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
    ].join(", ")}): ${needsGLL ? "readonly $AST[]" : "$AST"};\n`,
  };
}
