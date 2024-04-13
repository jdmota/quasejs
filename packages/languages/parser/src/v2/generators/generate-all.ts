import { Grammar } from "../grammar/grammar";
import { TokenDeclaration, RuleDeclaration } from "../grammar/grammar-builder";
import { lines } from "../utils/index";

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
    `  $getIdToLabel() {`,
    `    return ${JSON.stringify(grammar.tokens.makeIdToLabels(), null, 2)
      .split("\n")
      .join("\n    ")};`,
    `  }`,
    `  $getIdToChannels() {`,
    `    return ${JSON.stringify(grammar.tokens.makeIdToChannels(), null, 2)
      .split("\n")
      .join("\n    ")};`,
    `  }`,
    ...tokensCode.values(),
    `}\n`,
    ``,
    `class GrammarParser extends Parser {`,
    ...rulesCode.values(),
    `}\n`,
    ``,
    `export function parse(external, ${[
      "string",
      ...grammar.startRule.args.map(a => `$${a.arg}`),
    ].join(", ")}) {`,
    `  const input = new Input({ string });`,
    `  const tokenizer = new GrammarTokenizer(input, external);`,
    `  const parser = new GrammarParser(tokenizer, external);`,
    `  return parser.ctx.u(-1, ${`parser.rule${
      grammar.startRule.name
    }(${grammar.startRule.args.map(a => `$${a.arg}`).join(", ")})`});`,
    `}\n`,
  ]);
}
