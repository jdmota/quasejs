import { error } from "../../runtime/error";
import { Parser as RuntimeParser } from "../../runtime/parser";
import {
  GrammarTokenizer,
  Location,
  Position,
  Token,
  IdToken,
  StringToken,
  RegexpToken,
  ActionToken,
} from "./tokenizer";
import { Names, connectAstNodes } from "./names";

type BaseNode = {
  loc: Location;
  parent?: Node | null;
  nextSibling?: Node | null;
};

export type GrammarNode = BaseNode & {
  type: "Grammar";
  lexerRules: Map<string, LexerRule>;
  parserRules: Map<string, ParserRule>;
  rules: Map<string, LexerRule | ParserRule>;
  firstRule: ParserRule;
};

export type LexerCommand = BaseNode & {
  type: "LexerCommand";
  name: "channel" | "skip";
  args: Id[];
};

export type LexerRule = BaseNode & {
  type: "LexerRule";
  modifiers: { [key: string]: boolean };
  name: string;
  names: Names;
  rule: Node;
  commands: LexerCommand[];
};

export type ParserRule = BaseNode & {
  type: "ParserRule";
  modifiers: { [key: string]: boolean };
  name: string;
  names: Names;
  rule: Node;
};

export type Rule = LexerRule | ParserRule;

export type Id = BaseNode & {
  type: "Id";
  name: string;
};

export type RegexpNode = BaseNode & {
  type: "Regexp";
  pattern: string;
  flags: string;
  raw: string;
};

export type StringNode = BaseNode & {
  type: "String";
  value: string;
  raw: string;
};

export type ActionNode = BaseNode & {
  type: "Action";
  value: string;
};

export type OptionalOrRepetition = BaseNode & {
  type: "Optional" | "ZeroOrMore" | "OneOrMore";
  item: Node;
};

export type Thing = StringNode | RegexpNode | Id | Dot;

export type Named = BaseNode & {
  type: "Named";
  multiple: boolean;
  name: string;
  item: Thing;
};

export type Options = BaseNode & {
  type: "Options";
  options: Node[];
};

export type Empty = BaseNode & {
  type: "Empty";
};

export type Concat = BaseNode & {
  type: "Concat";
  body: Node[];
};

export type Dot = BaseNode & {
  type: "Dot";
};

export type Node =
  | GrammarNode
  | Rule
  | Named
  | Empty
  | Id
  | RegexpNode
  | StringNode
  | ActionNode
  | OptionalOrRepetition
  | Options
  | Concat
  | Dot;

export default class GrammarParser extends RuntimeParser<Token, string> {
  private lookaheadState: { token: Token; loc: Location } | null;
  inLexer: boolean;
  ids: Map<string, Id[]>;
  terminals: (StringNode | RegexpNode)[];

  constructor(text: string) {
    super(new GrammarTokenizer(text));
    this.lookaheadState = null;
    this.inLexer = false;
    this.ids = new Map();
    this.terminals = [];
  }

  private error(message: string, pos?: Position) {
    throw error(message, pos || this.tokenLoc.start);
  }

  // Override
  next() {
    if (this.lookaheadState) {
      this.lastTokenEnd = this.tokenLoc.end;
      this.token = this.lookaheadState.token;
      this.tokenLoc = this.lookaheadState.loc;
      this.lookaheadState = null;
    } else {
      super.next();
    }
    return this.token;
  }

  private match(t: string | Token): boolean {
    return typeof t === "object" ? this.token === t : this.token.label === t;
  }

  private eat(t: string | Token) {
    const token = this.token;
    if (this.match(t)) {
      this.next();
      return token;
    }
    return null;
  }

  private expect(t: string | Token) {
    const token = this.eat(t);
    if (token == null) {
      throw this.error(
        `Unexpected token ${this.token.label}, expected ${
          typeof t === "object" ? t.label : t
        }`
      );
    }
    return token;
  }

  private lookahead(): Token {
    if (!this.lookaheadState) {
      this.lookaheadState = {
        token: this.tokenizer.nextToken(),
        loc: this.tokenizer.loc(),
      };
    }
    return this.lookaheadState.token;
  }

  private _pushConcat(body: Node[], options: Node[], optionStart: Position) {
    if (body.length === 0) {
      options.push({
        type: "Empty",
        loc: this.locNode(optionStart),
      });
    } else if (body.length === 1) {
      options.push(body[0]);
    } else {
      options.push({
        type: "Concat",
        body,
        loc: this.locNode(optionStart),
      });
    }
  }

  parseExp(): Node {
    const start = this.startNode();
    const options: Node[] = [];
    let optionStart = start;
    let body: Node[] = [];

    while (true) {
      if (this.match("|")) {
        this._pushConcat(body, options, optionStart);
        this.expect("|");
        optionStart = this.startNode();
        body = [];
      }

      if (this.match(";") || this.match(")") || this.match("->")) {
        break;
      } else {
        body.push(this.parseItem());
      }
    }

    this._pushConcat(body, options, optionStart);

    if (options.length === 0) {
      return {
        type: "Empty",
        loc: this.locNode(start),
      };
    }

    if (options.length === 1) {
      return options[0];
    }

    return {
      type: "Options",
      options,
      loc: this.locNode(start),
    };
  }

  parseGroup(): Node {
    this.expect("(");
    const node = this.parseExp();
    this.expect(")");
    return node;
  }

  parseItem(): Node {
    const start = this.startNode();

    if (this.match("action")) {
      const value = (this.token as ActionToken).value;
      this.next();
      return {
        type: "Action",
        value,
        loc: this.locNode(start),
      };
    }

    let item;
    const ahead = this.lookahead();

    if (this.match("id") && (ahead.label === "=" || ahead.label === "+=")) {
      if (this.inLexer) {
        this.error(`Named parameters are not allowed on lexer`, start);
      }
      const name = (this.token as IdToken).image;
      this.next();
      this.next();
      const named: Named = {
        type: "Named",
        multiple: ahead.label === "+=",
        name,
        item: this.parseThing(),
        loc: this.locNode(start),
      };
      item = named;
    } else {
      item = this.parseAtom();
    }

    switch (this.token.label) {
      case "?":
        this.next();
        return {
          type: "Optional",
          item,
          loc: this.locNode(start),
        };
      case "*":
        this.next();
        return {
          type: "ZeroOrMore",
          item,
          loc: this.locNode(start),
        };
      case "+":
        this.next();
        return {
          type: "OneOrMore",
          item,
          loc: this.locNode(start),
        };
      default:
        return item;
    }
  }

  parseThing(): StringNode | RegexpNode | Id | Dot {
    return this.match("string")
      ? this.parseString()
      : this.match("regexp")
      ? this.parseRegexp()
      : this.match(".")
      ? this.parseDot()
      : this.parseId();
  }

  parseAtom(): Node {
    return this.match("(") ? this.parseGroup() : this.parseThing();
  }

  parseDot(): Dot {
    const start = this.startNode();
    this.expect(".");
    return {
      type: "Dot",
      loc: this.locNode(start),
    };
  }

  parseString(): StringNode {
    const start = this.startNode();
    const { value, image: raw } = this.expect("string") as StringToken;
    const node: StringNode = {
      type: "String",
      value,
      raw,
      loc: this.locNode(start),
    };
    if (!this.inLexer) {
      this.terminals.push(node);
    }
    return node;
  }

  parseRegexp(): RegexpNode {
    const start = this.startNode();
    const { pattern, flags, image: raw } = this.expect("regexp") as RegexpToken;
    const node: RegexpNode = {
      type: "Regexp",
      pattern,
      flags,
      raw,
      loc: this.locNode(start),
    };
    if (!this.inLexer) {
      this.terminals.push(node);
    }
    return node;
  }

  parseId(): Id {
    const start = this.startNode();
    const name: string = (this.expect("id") as IdToken).image;
    const item: Id = {
      type: "Id",
      name,
      loc: this.locNode(start),
    };
    const arr = this.ids.get(name) || [];
    arr.push(item);
    this.ids.set(name, arr);
    return item;
  }

  parseRule(): Rule {
    const start = this.startNode();
    const modifiers: { [key: string]: boolean } = {};
    const ids: IdToken[] = [this.expect("id") as IdToken];

    if (this.match("id")) {
      ids.push(this.token as IdToken);
      this.next();
    }

    if (ids.length > 1) {
      const modifier = ids[0].image;
      modifiers[modifier] = true;

      switch (modifier) {
        case "fragment":
          if (!this.inLexer) {
            this.error(`'fragment' is not a valid modifier in parser`, start);
          }
          break;
        case "start":
          if (this.inLexer) {
            this.error(`'start' is not a valid modifier in lexer`, start);
          }
          break;
        default:
          this.error(`'${modifier}' is not a valid modifier`, start);
      }
    }

    const name = ids[ids.length - 1].image;

    this.expect(":");
    const rule = this.parseExp();
    const commands: LexerCommand[] = [];

    if (this.inLexer && this.eat("->")) {
      commands.push(this.parseLexerCommand());
    }

    this.expect(";");

    return this.inLexer
      ? {
          type: "LexerRule",
          modifiers,
          name,
          names: new Names(),
          rule,
          commands,
          loc: this.locNode(start),
        }
      : {
          type: "ParserRule",
          modifiers,
          name,
          names: new Names(),
          rule,
          loc: this.locNode(start),
        };
  }

  parseLexerCommand(): LexerCommand {
    const start = this.startNode();

    const id = this.expect("id") as IdToken;
    const name = id.image;
    const args: Id[] = [];

    if (this.eat("(")) {
      while (!this.match(")")) {
        args.push(this.parseId());
        if (!this.eat(",")) {
          break;
        }
      }
      this.expect(")");
    }

    if (name === "channel") {
      if (args.length !== 1) {
        throw this.error(`Expected 1 argument but saw ${args.length}`, start);
      }
    } else if (name === "skip") {
      if (args.length !== 0) {
        throw this.error(`Expected 0 arguments but saw ${args.length}`, start);
      }
    } else {
      throw this.error(`'${name}' is not a valid lexer command`, start);
    }

    return {
      type: "LexerCommand",
      name,
      args,
      loc: this.locNode(start),
    };
  }

  parse(): GrammarNode {
    const start = this.startNode();
    const lexerRules = new Map();
    const parserRules = new Map();
    const rules = new Map();

    let firstRule;

    while (!this.match("EOF")) {
      if (this.eat("@")) {
        const loc = this.startNode();
        const { image: word } = this.expect("id") as IdToken;
        switch (word) {
          case "lexer":
            this.inLexer = true;
            break;
          case "parser":
            this.inLexer = false;
            break;
          default:
            this.error(`Expected 'lexer' or 'parser' but saw '${word}'`, loc);
        }
      }

      const rule = this.parseRule();

      if (rules.has(rule.name)) {
        this.error(`Rule ${rule.name} was already defined.`, rule.loc.start);
      }

      if (this.inLexer) {
        lexerRules.set(rule.name, rule);
      } else {
        parserRules.set(rule.name, rule);
        if (rule.modifiers.start) {
          if (firstRule) {
            throw new Error(
              `Two start rules: '${firstRule.name}' and '${rule.name}'`
            );
          } else {
            firstRule = rule as ParserRule;
          }
        }
      }
      rules.set(rule.name, rule);
      rule.names = connectAstNodes(rule, null, null);
    }

    if (!firstRule) {
      throw new Error(`No rule declared as start`);
    }

    return {
      type: "Grammar",
      lexerRules,
      parserRules,
      rules,
      firstRule,
      loc: this.locNode(start),
    };
  }
}
