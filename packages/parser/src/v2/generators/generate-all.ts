import { lines } from "../../../../util/miscellaneous.ts";
import { INTERNAL_START_RULE, type Grammar } from "../grammar/grammar.ts";
import { LEXER_RULE_NAME } from "../grammar/tokens.ts";

export function generateAll(
  grammar: Grammar,
  tokensCode: readonly string[],
  rulesCode: readonly string[],
  needGLL: ReadonlySet<string>
) {
  return lines([
    `import { Input } from "./runtime/input";`,
    `import { Tokenizer } from "./runtime/tokenizer";`,
    `import { Parser } from "./runtime/parser";`,
    `import { GLL } from "./runtime/gll";\n`,
    ``,
    `const $$EMPTY_OBJ = {};\n`,
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
    needGLL.has(LEXER_RULE_NAME)
      ? `  const tokGll = new GLL("token",tokenizer,"${LEXER_RULE_NAME}",[]); tokenizer.$setGLL(tokGll);`
      : "",
    needGLL.has(INTERNAL_START_RULE)
      ? `  const parserGll = new GLL("rule",parser,"${INTERNAL_START_RULE}",[${grammar.startRule.args.map(a => `$${a.arg}`).join(",")}]); parser.$setGLL(parserGll);`
      : "",
    `  return ${needGLL.has(INTERNAL_START_RULE) ? `parserGll.run()` : `parser.rule${grammar.startRule.name}_0(${grammar.startRule.args.map(a => `$${a.arg}`).join(",")})`};`,
    `}\n`,
  ]);
}
