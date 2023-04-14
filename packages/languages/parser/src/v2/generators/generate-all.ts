import { Grammar } from "../grammar/grammar";
import { TokenDeclaration, RuleDeclaration } from "../grammar/grammar-builder";
import { lines } from "../utils";

// TODO better types (not only on method signatures but also on local vars)
// TODO better types also on the results of this.e() calls
// TODO getIdToChannels

export function generateAll(
  grammar: Grammar,
  tokensCode: ReadonlyMap<TokenDeclaration, string>,
  rulesCode: ReadonlyMap<RuleDeclaration, string>
) {
  return lines([
    `import { Input } from "./runtime/input";`,
    `import { Tokenizer } from "./runtime/tokenizer";`,
    `import { Parser } from "./runtime/parser";\n`,
    ``,
    `const EMPTY_OBJ = {};\n`,
    ``,
    `class GrammarTokenizer extends Tokenizer {`,
    ...tokensCode.values(),
    `}\n`,
    ``,
    `class GrammarParser extends Parser {`,
    ...rulesCode.values(),
    `}\n`,
    ``,
    `export function parse(${[
      "string: string",
      ...grammar.startRule.args.map(a => `$${a.arg}: any`),
    ].join(", ")}) {`,
    `  const input = new Input({ string });`,
    `  const tokenizer = new GrammarTokenizer(input);`,
    `  const parser = new GrammarParser(tokenizer);`,
    `  return parser.rule${grammar.startRule.name}(${grammar.startRule.args
      .map(a => `$${a.arg}`)
      .join(", ")});`,
    `}\n`,
  ]);
}
