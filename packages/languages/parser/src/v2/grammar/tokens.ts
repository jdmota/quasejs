import { never } from "../utils";
import { builder, TokenDeclaration, TokenRules } from "./grammar-builder";

export class TokensStore {
  private readonly tokenIds = new Map<string, number>();
  private readonly tokens: (readonly [
    string,
    TokenRules | TokenDeclaration
  ])[] = [];
  private uuid: number = -1;

  constructor() {
    this.get(builder.eof());
  }

  get(token: TokenRules | TokenDeclaration): number {
    const name = this.getName(token);
    const curr = this.tokenIds.get(name);
    if (curr == null) {
      const id = this.uuid++;
      this.tokenIds.set(name, id);
      this.tokens.push([name, token]);
      return id;
    }
    return curr;
  }

  getName(token: TokenRules | TokenDeclaration) {
    switch (token.type) {
      case "string":
        return `#string:${token.string}`;
      case "regexp":
        return `#regexp:${token.regexp}`;
      case "eof":
        return "#eof";
      case "token":
        return token.name;
      default:
        never(token);
    }
  }

  [Symbol.iterator]() {
    return this.tokens.values();
  }

  // TODO
  createLexer() {
    const tokens = [];
    for (const [, token] of this.tokens) {
      const fieldIdSet = builder.field("id", builder.int(this.get(token)));
      switch (token.type) {
        case "token":
          if (token.modifiers.type === "normal") {
            tokens.push(
              token.return
                ? builder.seq(token.rule, token.return, fieldIdSet)
                : builder.seq(token.rule, fieldIdSet)
            );
          }
          break;
        case "string":
        case "regexp":
        case "eof":
          tokens.push(builder.seq(token, fieldIdSet));
          break;
        default:
          never(token);
      }
    }
    return builder.token(
      "#lexer",
      builder.choice(...tokens),
      {
        type: "normal",
      },
      builder.id("id")
    );
  }
}
