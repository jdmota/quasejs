import { Location } from "../runtime/input";
import { never, nonNull } from "../utils";
import {
  AnyRule,
  builder,
  Call2Rule,
  CallRule,
  ChoiceRule,
  EmptyRule,
  EofRule,
  FieldRule,
  IdRule,
  IntRule,
  ObjectRule,
  OptionalRule,
  PredicateRule,
  RegExpRule,
  Repeat1Rule,
  RepeatRule,
  RuleMap,
  SelectRule,
  SeqRule,
  StringRule,
  TokenDeclaration,
  TokenRules,
} from "./grammar-builder";

export const LEXER_RULE_NAME = "$lexer";

type ILocalPrefixer = {
  [key in keyof RuleMap]: (prefix: string, node: RuleMap[key]) => RuleMap[key];
};

const prefixLocalsVisitor: ILocalPrefixer = {
  seq(prefix: string, node: SeqRule) {
    return builder.seq(...node.rules.map(r => prefixLocals(prefix, r)));
  },

  choice(prefix: string, node: ChoiceRule) {
    return builder.choice(...node.rules.map(r => prefixLocals(prefix, r)));
  },

  repeat(prefix: string, node: RepeatRule) {
    return builder.repeat(prefixLocals(prefix, node.rule));
  },

  repeat1(prefix: string, node: Repeat1Rule) {
    return builder.repeat1(prefixLocals(prefix, node.rule));
  },

  optional(prefix: string, node: OptionalRule) {
    return builder.optional(prefixLocals(prefix, node.rule));
  },

  empty(prefix: string, node: EmptyRule) {
    return node;
  },

  eof(prefix: string, node: EofRule) {
    return node;
  },

  string(prefix: string, node: StringRule) {
    return node;
  },

  regexp(prefix: string, node: RegExpRule) {
    return node;
  },

  int(prefix: string, node: IntRule) {
    return node;
  },

  object(prefix: string, node: ObjectRule) {
    return builder.object(
      node.fields.map(
        ([key, value]) => [key, prefixLocals(prefix, value)] as const
      )
    );
  },

  id(prefix: string, node: IdRule) {
    return builder.id(`${prefix}${node.id}`);
  },

  select(prefix: string, node: SelectRule) {
    return builder.select(prefixLocals(prefix, node.parent), node.field);
  },

  call(prefix: string, node: CallRule) {
    return builder.call(
      node.id,
      node.args.map(a => prefixLocals(prefix, a))
    );
  },

  call2(prefix: string, node: Call2Rule) {
    return builder.call2(
      node.id,
      node.args.map(a => prefixLocals(prefix, a))
    );
  },

  field(prefix: string, node: FieldRule) {
    return node.multiple
      ? builder.fieldMultiple(
          `${prefix}${node.name}`,
          prefixLocals(prefix, node.rule)
        )
      : builder.field(`${prefix}${node.name}`, prefixLocals(prefix, node.rule));
  },

  predicate(prefix: string, node: PredicateRule) {
    return builder.predicate(prefixLocals(prefix, node.code));
  },
};

function setLoc<T extends { loc: Location | null }>(
  rule: T,
  loc: Location | null
) {
  if (loc != null) {
    rule.loc = loc;
  }
  return rule;
}

function prefixLocals<T extends AnyRule>(prefix: string, rule: T): T {
  return setLoc(
    prefixLocalsVisitor[rule.type](prefix, rule as any) as T,
    rule.loc
  );
}

function idToVar(id: number) {
  return `\$${id}`.replace("-", "_");
}

export class TokensStore {
  private readonly tokens = new Map<
    string,
    Readonly<{ decl: TokenDeclaration; id: number }>
  >();
  private readonly tokens2 = new Map<
    number,
    Readonly<{ decl: TokenDeclaration; name: string }>
  >();
  private uuid: number = -1;

  constructor() {
    // Ensure the EOF token exists
    this.get(builder.eof());
  }

  get(token: TokenRules | TokenDeclaration): number {
    const name = this.uniqName(token);
    const curr = this.tokens.get(name);
    if (curr == null) {
      const id = this.uuid++;
      const decl = this.ensureDeclaration(id, token);
      this.tokens.set(name, { decl, id });
      this.tokens2.set(id, { decl, name });
      return id;
    }
    return curr.id;
  }

  getDecl(id: number) {
    return nonNull(this.tokens2.get(id));
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
    for (const { decl } of this.tokens.values()) {
      yield decl;
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
        return builder.token(idToVar(id), token, [], { type: "normal" }, null);
      case "token":
        return token;
      default:
        never(token);
    }
  }

  createLexer() {
    const tokens = [];
    for (const [, { id, decl }] of this.tokens) {
      if (decl.modifiers.type === "normal") {
        const idNode = builder.int(id);
        const fieldIdSet = builder.field("id", idNode);
        const prefix = idToVar(id) + "_";
        tokens.push(
          builder.seq(
            prefixLocals(prefix, decl.rule),
            fieldIdSet,
            builder.field("token", prefixLocals(prefix, decl.return))
          )
        );
      }
    }
    return builder.token(
      LEXER_RULE_NAME,
      builder.seq(
        builder.field("$startPos", builder.call2("$getPos", [])),
        builder.choice(...tokens),
        builder.field(
          "loc",
          builder.call2("$getLoc", [builder.id("$startPos")])
        )
      ),
      [],
      {
        type: "normal",
      },
      builder.object([
        ["id", builder.id("id")],
        ["loc", builder.id("loc")],
        ["token", builder.id("token")],
      ])
    );
  }

  makeIdToLabels() {
    return Object.fromEntries(
      Array.from(this.tokens2).map(([id, { name }]) => [id, name])
    );
  }

  makeIdToChannels() {
    return Object.fromEntries(
      Array.from(this.tokens2).map(([id, { decl }]) => [
        id,
        { s: decl.modifiers.type === "skip", c: decl.modifiers.channels ?? [] },
      ])
    );
  }
}
