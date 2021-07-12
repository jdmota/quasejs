import { never } from "../utils";
import { builder, TokenDeclaration, TokenRules } from "./grammar-builder";

export class TokensStore {
  private readonly tokens = new Map<
    string,
    { token: TokenDeclaration; id: number }
  >();
  private uuid: number = -1;

  constructor() {
    this.get(builder.eof());
  }

  get(token: TokenRules | TokenDeclaration): number {
    const name = this.uniqName(token);
    const curr = this.tokens.get(name);
    if (curr == null) {
      const id = this.uuid++;
      this.tokens.set(name, { id, token: this.ensureDeclaration(id, token) });
      return id;
    }
    return curr.id;
  }

  private uniqName(token: TokenRules | TokenDeclaration) {
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

  *[Symbol.iterator]() {
    for (const { token } of this.tokens.values()) {
      yield token;
    }
  }

  private ensureDeclaration(
    id: number,
    token: TokenRules | TokenDeclaration
  ): TokenDeclaration {
    switch (token.type) {
      case "string":
      case "regexp":
      case "eof":
        return builder.token(`\$${id}`, token, { type: "normal" }, null);
      case "token":
        return token;
      default:
        never(token);
    }
  }

  // TODO text extraction
  createLexer() {
    const tokens = [];
    for (const [, { id, token }] of this.tokens) {
      const idNode = builder.int(id);
      const fieldIdSet = builder.field("id", idNode);
      if (token.modifiers.type === "normal") {
        tokens.push(
          token.return
            ? builder.seq(
                token.rule,
                fieldIdSet,
                builder.field("token", token.return)
              )
            : builder.seq(token.rule, fieldIdSet)
        );
      }
    }
    return builder.token(
      "$lexer",
      builder.choice(...tokens),
      {
        type: "normal",
      },
      builder.object({ id: builder.id("id"), token: builder.id("token") })
    );
  }
}
