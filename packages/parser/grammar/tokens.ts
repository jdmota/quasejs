import { type Range } from "../../util/range-utils.ts";
import { assertion, never } from "../../util/miscellaneous.ts";
import { type Location } from "../runtime/input.ts";
import { type AugmentedTokenDeclaration, augmentToken } from "./grammar.ts";
import {
  type AnyRule,
  type Call2Rule,
  type CallRule,
  type ChoiceRule,
  type EmptyRule,
  type EofRule,
  type FieldRule,
  type IdRule,
  type IntRule,
  type BoolRule,
  type ObjectRule,
  type OptionalRule,
  type PredicateRule,
  type RegExpRule,
  type Repeat1Rule,
  type RepeatRule,
  type RuleMap,
  type SeqRule,
  type StringRule,
  type TokenRules,
  type NullRule,
  builder,
} from "./grammar-builder.ts";

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

  bool(prefix: string, node: BoolRule) {
    return node;
  },

  null(prefix: string, node: NullRule) {
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
    Readonly<{ decl: AugmentedTokenDeclaration; id: number }>
  >();
  private readonly tokens2 = new Map<
    number,
    Readonly<{ decl: AugmentedTokenDeclaration; name: string }>
  >();
  private uuid: number = -1;
  private MIN: number;
  private MAX: number;

  constructor() {
    // Ensure the EOF token exists
    const eof = this.get(builder.eof());
    assertion(eof === -1);
    this.MIN = eof;
    this.MAX = eof;
  }

  anyRange(): Range {
    return { from: this.MIN, to: this.MAX };
  }

  get(token: TokenRules | AugmentedTokenDeclaration): number {
    const name = this.uniqName(token);
    const curr = this.tokens.get(name);
    if (curr == null) {
      const id = this.uuid++;
      const decl = this.ensureDeclaration(id, token);
      this.tokens.set(name, { decl, id });
      this.tokens2.set(id, { decl, name });
      this.MAX = id;
      return id;
    }
    return curr.id;
  }

  getDecl(id: number) {
    return this.tokens2.get(id);
  }

  private uniqName(token: TokenRules | AugmentedTokenDeclaration) {
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
    token: TokenRules | AugmentedTokenDeclaration
  ): AugmentedTokenDeclaration {
    switch (token.type) {
      case "string":
      case "regexp":
        return augmentToken(
          builder.token(
            idToVar(id),
            builder.field("t", token),
            [],
            { type: "normal" },
            builder.id("t")
          )
        );
      case "eof":
        return augmentToken(
          builder.token(
            idToVar(id),
            token,
            [],
            { type: "normal" },
            builder.null()
          )
        );
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
    return augmentToken(
      builder.token(
        LEXER_RULE_NAME,
        builder.choice(...tokens),
        [],
        {
          type: "normal",
        },
        builder.object([
          ["id", builder.id("id")],
          ["token", builder.id("token")],
        ])
      )
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
