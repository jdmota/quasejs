import { never } from "../utils";
import { TokenDeclaration, TokenRules } from "./grammar-builder";

export class TokensStore {
  private readonly tokens = new Map<string, number>();
  private uuid: number = -1;

  constructor() {
    this.store("eof");
  }

  get(token: TokenRules | TokenDeclaration): number {
    return this.store(this.raw(token));
  }

  private raw(token: TokenRules | TokenDeclaration) {
    switch (token.type) {
      case "string":
        return `string:${token.string}`;
      case "regexp":
        return `regexp:${token.regexp}`;
      case "eof":
        return "eof";
      case "token":
        return `token:${token.name}`;
      default:
        never(token);
    }
  }

  private store(raw: string): number {
    const curr = this.tokens.get(raw);
    if (curr == null) {
      const id = this.uuid++;
      this.tokens.set(raw, id);
      return id;
    }
    return curr;
  }
}
