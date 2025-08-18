import type { SchemaType } from "../schema/schema-type.ts";
import { createGrammar } from "./grammar/grammar.ts";
import {
  type RuleDeclaration,
  type TokenDeclaration,
} from "./grammar/grammar-builder.ts";
import { locSuffix } from "./utils/index.ts";
import {
  generateGrammar,
  inferAndCheckTypes,
} from "./grammar/grammar-generate.ts";

// TODO support parallel lexers? context-sensitive tokenization?
// TODO support disambiguation tactics

// TODO generate visitors

// TODO support error recovery, and filling the missing tokens
// TODO support incremental parsings
// TODO support importing other grammars
// TODO left recursion removal https://www.antlr.org/papers/allstar-techreport.pdf

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

function precedenceLeftAssoc(number: number, rule: AnyRule) {
  // TODO https://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl
}

function precedenceRightAssoc(number: number, rule: AnyRule) {
  // TODO https://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl
}
*/

export type LookaheadOpts = Readonly<{
  maxLL?: number;
  maxFF?: number;
}>;

export type ToolInput = Readonly<{
  name: string;
  ruleDecls?: readonly RuleDeclaration[];
  tokenDecls?: readonly TokenDeclaration[];
  startArguments?: readonly SchemaType[];
  externalFuncReturns?: Readonly<Record<string, SchemaType>>;
  parser?: LookaheadOpts;
  tokenizer?: LookaheadOpts;
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

  const { genTypes, errors: typeErrors } = inferAndCheckTypes(result.grammar);

  if (typeErrors.length) {
    for (const { message, loc } of typeErrors) {
      console.error(message, locSuffix(loc));
    }
    return null;
  }

  const { code, gllInfo } = generateGrammar(result);

  return {
    code,
    types: genTypes(gllInfo),
    grammar: result.grammar,
  };
}
