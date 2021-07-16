import { Location } from "../runtime/input";
import { never } from "../utils";
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

type ILocalPrefixer = {
  [key in keyof RuleMap]: (prefix: string, node: RuleMap[key]) => RuleMap[key];
};

const prefixLocalsObj: ILocalPrefixer = {
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

  object(prefix: string, node: ObjectRule) {
    return builder.object(
      node.fields.map(
        ([key, value]) => [key, prefixLocals(prefix, value)] as const
      )
    );
  },

  int(prefix: string, node: IntRule) {
    return node;
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
    return setLoc(builder.predicate(prefixLocals(prefix, node.code)), node.loc);
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
  return setLoc(prefixLocalsObj[rule.type](prefix, rule as any) as T, rule.loc);
}

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
          prefixLocals(
            `$${id}_`,
            builder.seq(
              token.rule,
              fieldIdSet,
              builder.field("token", token.return)
            )
          )
        );
      }
    }
    return builder.token(
      "$lexer",
      builder.choice(...tokens),
      {
        type: "normal",
      },
      builder.object([
        ["id", builder.id("id")],
        ["token", builder.id("token")],
      ])
    );
  }
}
