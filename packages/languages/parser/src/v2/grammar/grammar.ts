import { never } from "../utils";
import { RuleDeclaration, TokenRules } from "./grammar-builder";
import {
  ReadonlyFieldsStore,
  getFields,
  checkAmbiguousFields,
  gatherTokens,
} from "./grammar-checker";

export class Grammar {
  readonly name: string;
  readonly rules: ReadonlyMap<string, RuleDeclaration>;
  readonly startRules: RuleDeclaration[];
  readonly fields: ReadonlyMap<string, ReadonlyFieldsStore>;
  readonly ambiguousFields: ReadonlyMap<string, string[]>;
  readonly tokens: ReadonlyMap<TokenRules, number>;
  readonly tokenIds: readonly [number, number];

  constructor({ name, rules }: { name: string; rules: RuleDeclaration[] }) {
    const fields = rules.map(
      rule => [rule.name, getFields(rule.rule)] as const
    );
    const ambiguousFields = fields.map(
      ([name, store]) => [name, checkAmbiguousFields(store)] as const
    );
    this.name = name;
    this.rules = new Map(rules.map(r => [r.name, r]));
    this.startRules = rules.filter(r => r.modifiers.start);
    this.fields = new Map(fields);
    this.ambiguousFields = new Map(ambiguousFields);

    // Gather tokens and assign ids
    const tokensList = gatherTokens(rules.map(r => r.rule));
    const tokens = new Map<TokenRules, number>();
    const nameToId = new Map<string, number>([["eof", 0]]);
    let lastTokenId = 1;
    for (const t of tokensList) {
      const name = this.tokenName(t);
      const id = nameToId.get(name) ?? lastTokenId++;
      nameToId.set(name, id);
      tokens.set(t, id);
    }
    this.tokens = tokens;
    this.tokenIds = [0, lastTokenId - 1];
  }

  tokenName(token: TokenRules) {
    switch (token.type) {
      case "eof":
        return "eof";
      case "string":
        return `str:${token.string}`;
      case "regexp":
        return `regexp:${token.regexp}`;
      default:
        never(token);
    }
  }

  getRule(ruleName: string) {
    const rule = this.rules.get(ruleName);
    if (rule == null) {
      throw new Error(`No rule called ${ruleName}`);
    }
    return rule;
  }
}
