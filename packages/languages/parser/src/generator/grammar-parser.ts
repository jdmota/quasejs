import { Parser } from "../parser";
import { Tokenizer, Location, Position } from "../tokenizer";
import { printLoc } from "./utils";

const idChars = /[$_0-9a-z]/i;
const hexDigit = /[0-9a-f]/i;

const escapeToValue: { [key: string]: string } = {
  b: "\b",
  t: "\t",
  n: "\n",
  f: "\f",
  r: "\r",
  "'": "'",
  "\\": "\\",
};

type IdToken = {
  label: "id";
  word: string;
};

type StringToken = {
  label: "string";
  value: string;
  raw: string;
};

type RegexpToken = {
  label: "regexp";
  patterns: string;
  flags: string;
  raw: string;
};

type Token = {
  label: string;
} | IdToken | StringToken | RegexpToken;

class GrammarTokenizer extends Tokenizer<Token> {

  initial(): Token {
    return {
      label: "initial"
    };
  }

  eof(): Token {
    return {
      label: "eof"
    };
  }

  identifier( word: string ): Token {
    return {
      label: "id",
      word
    };
  }

  readWord() {
    const start = this.pos;
    while ( this.pos < this.inputLen ) {
      if ( idChars.test( this.charAt( this.pos ) ) ) {
        this.pos++;
      } else {
        break;
      }
    }
    return this.input.slice( start, this.pos );
  }

  readIdentifier() {
    return this.identifier( this.readWord() );
  }

  readHex() {
    let hex = "";
    while ( true ) {
      const c = this.charAt( this.pos );

      if ( hexDigit.test( c ) ) {
        hex += c;
        this.pos++;

        if ( hex.length > 6 ) {
          throw this.error( "Invalid unicode escape sequence" );
        }
      } else {
        break;
      }
    }

    if ( hex.length === 0 ) {
      throw this.error( "Invalid unicode escape sequence" );
    }

    return String.fromCodePoint( Number.parseInt( hex, 16 ) );
  }

  readString() {
    const start = this.pos;
    this.pos++;

    let value = "";

    while ( true ) {
      const c = this.charAt( this.pos );

      // End of input or new line
      if ( this.pos >= this.inputLen || this.isNewLine( c.charCodeAt( 0 ) ) ) {
        throw this.error( "Unterminated string" );
      }

      // String close
      if ( c === "'" ) {
        if ( this.pos - start === 1 ) {
          throw this.error( "Empty string" );
        }
        this.pos++;
        break;
      }

      // Escape
      if ( c === "\\" ) {
        this.pos++;
        const c = this.charAt( this.pos );

        if ( c === "u" ) {
          this.pos++;
          value += this.readHex();
        } else {
          const v = escapeToValue[ c ];
          if ( v ) {
            value += v;
            this.pos++;
          } else {
            throw this.error( "Invalid escape sequence" );
          }
        }
      } else {
        value += c;
        this.pos++;
      }
    }

    return {
      label: "string",
      value,
      raw: this.input.slice( start, this.pos )
    };
  }

  readRegexp() {
    const start = this.pos;
    let escaped = false;
    let inClass = false;

    this.pos++;

    while ( true ) {
      const c = this.codeAt( this.pos );

      if ( this.pos >= this.inputLen || this.isNewLine( c ) ) {
        throw this.error( "Unterminated regular expression" );
      }

      if ( escaped ) {
        escaped = false;
      } else {
        if ( c === 91 ) { // "["
          inClass = true;
        } else if ( c === 93 && inClass ) { // "]"
          inClass = false;
        } else if ( c === 47 && !inClass ) { // "/"
          this.pos++;
          break;
        }
        escaped = c === 92; // "\\"
      }
      this.pos++;
    }

    const pattern = this.input.slice( start + 1, this.pos - 1 );

    const flags = this.readWord();
    if ( flags ) {
      const validFlags = /^[gmsiyu]*$/;
      if ( !validFlags.test( flags ) ) {
        throw this.error( "Invalid regular expression flag" );
      }
    }

    return {
      label: "regexp",
      pattern,
      flags,
      raw: this.input.slice( start, this.pos )
    };
  }

  readToken(): Token {
    const char = this.charAt( this.pos );

    if ( char === "'" ) {
      return this.readString();
    }

    if ( char === "/" ) {
      return this.readRegexp();
    }

    if ( idChars.test( char ) ) {
      return this.readIdentifier();
    }

    switch ( char ) {
      case "(":
      case ")":
      case "|":
      case "?":
      case "*":
      case "+":
        if ( this.charAt( this.pos + 1 ) === "=" ) {
          this.pos += 2;
          return {
            label: "+="
          };
        }
      case ":": // eslint-disable-line no-fallthrough
      case "=":
      case ";":
      case "@":
        this.pos++;
        return {
          label: char
        };
      default:
    }

    throw this.unexpectedChar();
  }

}

type BaseNode = {
  loc: Location;
  parent?: Node | null;
  scope?: ParserRule | null;
  nextSibling?: Node | null;
};

type ScopeNames = {
  names: { [key: string]: "array" | "single" };
};

export type GrammarNode = BaseNode & {
  type: "Grammar";
  lexerRules: Map<string, LexerRule>;
  parserRules: Map<string, ParserRule>;
  rules: Map<string, LexerRule | ParserRule>;
  firstRule: ParserRule;
};

export type LexerRule = BaseNode & {
  type: "LexerRule";
  modifiers: { [key: string]: boolean };
  name: string;
  rule: Node;
};

export type ParserRule = BaseNode & ScopeNames & {
  type: "ParserRule";
  modifiers: { [key: string]: boolean };
  name: string;
  rule: Node;
};

export type Rule = LexerRule | ParserRule;

export type Id = BaseNode & {
  type: "Id";
  name: string;
};

export type RegexpNode = BaseNode & {
  type: "Regexp";
  patterns: string;
  flags: string;
  raw: string;
};

export type StringNode = BaseNode & {
  type: "String";
  value: string;
  raw: string;
};

export type OptionalOrRepetition = BaseNode & {
  type: "Optional" | "ZeroOrMore" | "OneOrMore";
  item: Node;
};

export type Named = BaseNode & {
  type: "Named";
  multiple: boolean;
  name: string;
  item: StringNode | RegexpNode | Id;
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

export type Node =
  GrammarNode | Rule | Named |
  Id | RegexpNode | StringNode |
  OptionalOrRepetition |
  Options | Concat | Empty;

function connectAstNodes(
  node: Node, parent: Node | null, scope: ParserRule | null, nextSibling: Node | null
) {
  switch ( node.type ) {
    case "LexerRule":
      connectAstNodes( node.rule, node, scope, null );
      break;
    case "ParserRule":
      node.names = {};
      connectAstNodes( node.rule, node, node, null );
      break;
    case "Options": {
      if ( scope == null ) {
        throw new Error( "Assertion error" );
      }
      const originalNames = scope.names;
      const names = { ...originalNames };
      for ( const opt of node.options ) {
        scope.names = { ...originalNames };
        connectAstNodes( opt, node, scope, nextSibling );
        for ( const key in scope.names ) {
          if ( names[ key ] !== "array" ) {
            names[ key ] = scope.names[ key ];
          }
        }
      }
      scope.names = names;
      break;
    }
    case "Concat": {
      const lastIndex = node.body.length - 1;
      for ( let i = 0; i < lastIndex; i++ ) {
        connectAstNodes( node.body[ i ], node, scope, node.body[ i + 1 ] );
      }
      connectAstNodes( node.body[ lastIndex ], node, scope, nextSibling );
      break;
    }
    case "Optional":
      connectAstNodes( node.item, node, scope, nextSibling );
      break;
    case "ZeroOrMore":
    case "OneOrMore":
      connectAstNodes( node.item, node, scope, nextSibling );
      break;
    case "Id":
    case "String":
    case "Regexp":
    case "Empty":
      break;
    case "Named": {
      if ( scope == null ) {
        throw new Error( "Assertion error" );
      }
      if ( node.name === "type" || node.name === "loc" ) {
        throw new Error( `Cannot have named parameter called '${node.name}' (${printLoc( node )})` );
      }
      const prev = scope.names[ node.name ];
      scope.names[ node.name ] = node.multiple ? "array" : "single";
      if ( prev && prev !== scope.names[ node.name ] ) {
        throw new Error( `${node.name} is an array or a single value?` );
      }
      connectAstNodes( node.item, node, scope, nextSibling );
      break;
    }
    default:
      throw new Error( `Unexpected node: ${node.type}` );
  }
  node.parent = parent;
  node.scope = scope;
  node.nextSibling = nextSibling;
  return node;
}

export default class GrammarParser extends Parser<Token> {

  inLexer: boolean;
  ids: Map<string, Id[]>;
  terminals: ( StringNode | RegexpNode )[];

  constructor( text: string ) {
    super( new GrammarTokenizer( text ) );
    this.inLexer = false;
    this.ids = new Map();
    this.terminals = [];
  }

  private _pushConcat( body: Node[], options: Node[], optionStart: Position ) {
    if ( body.length === 0 ) {
      options.push( {
        type: "Empty",
        loc: this.locNode( optionStart )
      } );
    } else if ( body.length === 1 ) {
      options.push( body[ 0 ] );
    } else {
      options.push( {
        type: "Concat",
        body,
        loc: this.locNode( optionStart )
      } );
    }
  }

  parseExp(): Node {
    const start = this.startNode();
    const options: Node[] = [];
    let optionStart = start;
    let body: Node[] = [];

    while ( true ) {
      if ( this.match( "|" ) ) {
        this._pushConcat( body, options, optionStart );
        this.expect( "|" );
        optionStart = this.startNode();
        body = [];
      }

      if ( this.match( ";" ) || this.match( ")" ) ) {
        break;
      } else {
        body.push( this.parseItem() );
      }
    }

    this._pushConcat( body, options, optionStart );

    if ( options.length === 0 ) {
      return {
        type: "Empty",
        loc: this.locNode( start )
      };
    }

    if ( options.length === 1 ) {
      return options[ 0 ];
    }

    return {
      type: "Options",
      options,
      loc: this.locNode( start )
    };
  }

  parseGroup(): Node {
    this.expect( "(" );
    const node = this.parseExp();
    this.expect( ")" );
    return node;
  }

  parseItem(): Node {
    const start = this.startNode();
    let item;

    const ahead = this.lookahead();

    if ( this.match( "id" ) && ( ahead.label === "=" || ahead.label === "+=" ) ) {
      if ( this.inLexer ) {
        this.error( `Named parameters are not allowed on lexer`, start );
      }
      const name = ( this.token as IdToken ).word;
      this.next();
      this.next();
      const named: Named = {
        type: "Named",
        multiple: ahead.label === "+=",
        name,
        item: this.parseThing(),
        loc: this.locNode( start )
      };
      item = named;
    } else {
      item = this.parseAtom();
    }

    switch ( this.token.label ) {
      case "?":
        this.next();
        return {
          type: "Optional",
          item,
          loc: this.locNode( start )
        };
      case "*":
        this.next();
        return {
          type: "ZeroOrMore",
          item,
          loc: this.locNode( start )
        };
      case "+":
        this.next();
        return {
          type: "OneOrMore",
          item,
          loc: this.locNode( start )
        };
      default:
        return item;
    }
  }

  parseThing(): StringNode | RegexpNode | Id {
    return this.match( "string" ) ? this.parseString() :
      this.match( "regexp" ) ? this.parseRegexp() : this.parseId();
  }

  parseAtom(): Node {
    return this.match( "(" ) ? this.parseGroup() : this.parseThing();
  }

  parseString(): StringNode {
    const start = this.startNode();
    const { value, raw } = this.expect( "string" ) as StringToken;
    const node: StringNode = {
      type: "String",
      value,
      raw,
      loc: this.locNode( start )
    };
    if ( !this.inLexer ) {
      this.terminals.push( node );
    }
    return node;
  }

  parseRegexp(): RegexpNode {
    const start = this.startNode();
    const { patterns, flags, raw } = this.expect( "regexp" ) as RegexpToken;
    const node: RegexpNode = {
      type: "Regexp",
      patterns,
      flags,
      raw,
      loc: this.locNode( start )
    };
    if ( !this.inLexer ) {
      this.terminals.push( node );
    }
    return node;
  }

  parseId(): Id {
    const start = this.startNode();
    const name: string = ( this.expect( "id" ) as IdToken ).word;
    const item: Id = {
      type: "Id",
      name,
      loc: this.locNode( start )
    };
    const arr = this.ids.get( name ) || [];
    arr.push( item );
    this.ids.set( name, arr );
    return item;
  }

  parseRule(): Rule {
    const start = this.startNode();
    const modifiers: { [key: string]: boolean } = {};
    const ids: IdToken[] = [ this.expect( "id" ) as IdToken ];

    if ( this.match( "id" ) ) {
      ids.push( this.token as IdToken );
      this.next();
    }

    if ( ids.length > 1 ) {
      const modifier = ids[ 0 ].word;
      modifiers[ modifier ] = true;

      switch ( modifier ) {
        case "fragment":
          if ( !this.inLexer ) {
            this.error( `'fragment' is not a valid modifier in parser`, start );
          }
          break;
        case "start":
          if ( this.inLexer ) {
            this.error( `'start' is not a valid modifier in lexer`, start );
          }
          break;
        default:
          this.error( `'${modifier}' is not a valid modifier`, start );
      }
    }

    const name = ids[ ids.length - 1 ].word;

    this.expect( ":" );
    const rule = this.parseExp();
    this.expect( ";" );
    return this.inLexer ? {
      type: "LexerRule",
      modifiers,
      name,
      rule,
      loc: this.locNode( start )
    } : {
      type: "ParserRule",
      modifiers,
      name,
      names: {},
      rule,
      loc: this.locNode( start )
    };
  }

  parse(): GrammarNode {
    const start = this.startNode();
    const lexerRules = new Map();
    const parserRules = new Map();
    const rules = new Map();

    let firstRule;

    while ( !this.match( "eof" ) ) {

      if ( this.eat( "@" ) ) {
        const loc = this.startNode();
        const { word } = this.expect( "id" ) as IdToken;
        switch ( word ) {
          case "lexer":
            this.inLexer = true;
            break;
          case "parser":
            this.inLexer = false;
            break;
          default:
            this.error( `Expected 'lexer' or 'parser' but saw '${word}'`, loc );
        }
      }

      const rule = this.parseRule();

      if ( rules.has( rule.name ) ) {
        this.error( `Rule ${rule.name} was already defined.`, rule.loc.start );
      }

      if ( this.inLexer ) {
        lexerRules.set( rule.name, rule );
      } else {
        parserRules.set( rule.name, rule );
        if ( rule.modifiers.start ) {
          if ( firstRule ) {
            throw new Error( `Two start rules: '${firstRule.name}' and '${name}'` );
          } else {
            firstRule = rule as ParserRule;
          }
        }
      }
      rules.set( rule.name, rule );
      connectAstNodes( rule, null, null, null );
    }

    if ( !firstRule ) {
      throw new Error( `No rule declared as start` );
    }

    return {
      type: "Grammar",
      lexerRules,
      parserRules,
      rules,
      firstRule,
      loc: this.locNode( start )
    };
  }

}
