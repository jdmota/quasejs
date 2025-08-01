import { createGrammar } from "./grammar/grammar.ts";
import {
  type RuleDeclaration,
  type TokenDeclaration,
} from "./grammar/grammar-builder.ts";
import { locSuffix } from "./utils/index.ts";
import { type GType } from "./grammar/type-checker/types-builder.ts";
import {
  generateGrammar,
  inferAndCheckTypes,
} from "./grammar/grammar-generate.ts";

// TODO runtime follow stack will not work with gll
// TODO tokenizer with gll?... support parallel lexers?

// TODO implement error recovery, and filling the missing tokens
// TODO implement incremental parsings
// TODO left recursion removal https://www.antlr.org/papers/allstar-techreport.pdf

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

function precedenceLeftAssoc(number: number, rule: AnyRule) {
  // TODO https://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl
}

function precedenceRightAssoc(number: number, rule: AnyRule) {
  // TODO https://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl
}
*/

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

  const { genTypes, errors: typeErrors } = inferAndCheckTypes(result.grammar);

  if (typeErrors.length) {
    for (const { message, loc } of typeErrors) {
      console.error(message, locSuffix(loc));
    }
    return null;
  }

  const { code, needGLL } = generateGrammar(result);

  return {
    code,
    types: genTypes(needGLL.size > 0),
    grammar: result.grammar,
  };
}
