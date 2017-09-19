import escapeRegexp from "../../_helper/escapeRegExp";
import { normalizePre } from "./normalize";

const DEFAULT_GROUP = "[^\\/]+?";
const EXCLAMATION_MARK_CODE = 33;

function tokenizer( str ) {

  const tokens = [];
  const len = str.length;

  for ( let i = 0; i < len; i++ ) {
    const c = str.charCodeAt( i );
    const v = str.charAt( i );

    if ( c === 40 || c === 41 ) { // "(" || ")"
      tokens.push( {
        value: v,
        other: false,
        isModifier: false,
        canBeAlone: false,
        column: i
      } );
      continue;
    }

    if ( c === 42 ) { // "*"
      if ( str.charCodeAt( i + 1 ) === 42 ) {
        if ( str.charCodeAt( i + 2 ) === 42 ) {
          throw new SyntaxError( "*** not allowed at " + i );
        }
        tokens.push( {
          value: "**",
          other: false,
          isModifier: true,
          canBeAlone: true,
          column: i
        } );
        i++;
      } else {
        tokens.push( {
          value: v,
          other: false,
          isModifier: true,
          canBeAlone: true,
          column: i
        } );
      }
      continue;
    }

    if ( c === 63 ) { // "?"
      tokens.push( {
        value: v,
        other: false,
        isModifier: true,
        canBeAlone: true,
        column: i
      } );
      continue;
    }

    if ( c === 43 || c === 33 ) { // "+" || "!"
      tokens.push( {
        value: v,
        other: false,
        isModifier: true,
        canBeAlone: false,
        column: i
      } );
      continue;
    }

    // "/" || "<" || ">" || "," || "|" ||
    // "\\" || "[" || "]" || "{" || "}"
    if (
      c === 47 || c === 60 || c === 62 || c === 44 || c === 124 ||
      c === 92 || c === 91 || c === 93 || c === 123 || c === 125
    ) {
      tokens.push( {
        value: v,
        other: false,
        isModifier: false,
        canBeAlone: false,
        column: i
      } );
      continue;
    }

    tokens.push( {
      value: v,
      other: true,
      isModifier: false,
      canBeAlone: false,
      column: i
    } );

  }

  return tokens;
}

/*
{ type: "Slash" }
{ type: "Asterik" }
{ type: "Globstar" }
{ type: "Question" }
{ type: "Text", value: "" }
{ type: "Range", expression: "" }
{ type: "Parameter", modifier: "" || undefined, name: "", expression: PatternList || Pattern || null }
{ type: "PatternList", patterns: Pattern[] }
{ type: "Pattern", body: Node[] }
*/

const SLASH = { type: "Slash" };
const ASTERISK = { type: "Asterisk" };
const GLOBSTAR = { type: "Globstar" };
const QUESTION = { type: "Question" };

const PARSER_STATE = {
  current: 0,
  tokens: null,
  lastToken: null,

  parse( str ) {
    this.tokens = tokenizer( str );
    this.current = 0;

    const len = this.tokens.length;
    const ast = {
      type: "Pattern",
      body: []
    };

    this.lastToken = this.tokens[ len - 1 ];

    while ( this.current < len ) {
      ast.body.push( this.walk() );
    }

    this.tokens = null;
    return ast;
  },

  lookahead() {
    return this.tokens[ this.current + 1 ];
  },

  next() {
    return this.tokens[ ++this.current ];
  },

  get() {
    return this.tokens[ this.current ];
  },

  error( str, column ) {
    if ( /end of input/.test( str ) ) {
      throw new SyntaxError( str );
    } else {
      throw new SyntaxError( `${str} at ${column == null ? this.get().column : column}` );
    }
  },

  walk() {

    let token = this.get();
    const value = token.value;

    if ( value === "/" ) {
      this.next();
      return SLASH;
    }

    if ( value === "<" ) {
      return this.parseParameterWithName();
    }

    if ( token.isModifier ) {

      const next = this.lookahead();

      if ( next && next.value === "(" ) {
        this.next();
        return {
          type: "Parameter",
          modifier: token.value,
          name: undefined,
          expression: this.parseList()
        };
      }

      // Continue...

    }

    if ( value === "?" ) {
      this.next();
      return QUESTION;
    }

    if ( value === "**" ) {
      this.next();
      return GLOBSTAR;
    }

    if ( value === "*" ) {
      this.next();
      return ASTERISK;
    }

    if ( token.other || value === "\\" || ( token.isModifier && !token.canBeAlone ) ) {

      const node = {
        type: "Text",
        value: ""
      };

      do {
        if ( token.value === "\\" ) {
          token = this.next();
          if ( token ) {
            node.value += token.value;
          } else {
            this.error( "Unexpected end of input" );
          }
        } else {
          node.value += token.value;
        }
        token = this.next();
      } while ( token && ( token.other || token.value === "\\" ) );

      return node;
    }

    if ( value === "(" ) {
      return this.parseList();
    }

    if ( value === "[" ) {
      return this.parseRange();
    }

    this.error( "Unexpected token" );

  },

  parseParameterWithName() {

    let token = this.next();
    let name = "";

    while ( token && token.other ) {
      name += token.value;
      token = this.next();
    }

    if ( !token ) {
      this.error( "Unexpected end of input" );
    }

    if ( !name ) {
      this.error( "Expected a valid identifier" );
    }

    let modifier;

    if ( token.isModifier ) {
      modifier = token.value;
      token = this.next();
    }

    const expression = token.value === "(" ? this.parseList() : null;

    token = this.get();

    if ( token.value !== ">" ) {
      this.error( "Expected > but saw " + token.value );
    }

    this.next();

    return {
      type: "Parameter",
      modifier: modifier,
      name: name,
      expression: expression
    };

  },

  parseList() {

    // Current token is "("

    const node = {
      type: "PatternList",
      patterns: []
    };

    let pattern = {
      type: "Pattern",
      body: []
    };

    let token = this.next();

    while ( token && token.value !== ")" ) {
      if ( token.value === "|" ) {
        node.patterns.push( pattern );
        pattern = {
          type: "Pattern",
          body: []
        };
        token = this.next();
      } else {
        pattern.body.push( this.walk() );
        token = this.get();
      }
    }

    if ( !token ) {
      this.error( "Unexpected end of input: missing )" );
    }

    node.patterns.push( pattern );

    this.next();

    return node.patterns.length === 1 ? node.patterns[ 0 ] : node;

  },

  parseRange() {
    const node = {
      type: "Range",
      expression: ""
    };

    const column = this.get().column;

    let token = this.next();
    let prev;

    while ( token && ( token.value !== "]" || prev === "\\" ) ) {
      prev = token.value;
      node.expression += prev;
      token = this.next();
    }

    if ( !token ) {
      this.error( "Unexpected end of input: missing ]" );
    }

    if ( node.expression.charCodeAt( 0 ) === 33 ) { // "!"
      node.expression = "^" + node.expression.substring( 1 );
    }

    try {
      new RegExp( node.expression ); // eslint-disable-line no-new
    } catch ( e ) {
      this.error( e.toString().replace( /^SyntaxError:\s/, "" ), column );
    }

    this.next();

    return node;
  }

};

const GENERATOR = {

  names: null,
  allowDots: false,
  _asterisk: null,
  _globstar: null,
  _question: "[^\\/]",

  generate( node, allowDots ) {
    this.names = [];
    this.allowDots = allowDots;
    this._asterisk = this.processToken( null, false, true, false, false, DEFAULT_GROUP );
    this._globstar = this.processToken( null, false, true, true, true, DEFAULT_GROUP );
    return this.generator( node );
  },

  generator( node ) {

    switch ( node.type ) {

      case "Asterisk":
        return this._asterisk;

      case "Globstar":
        return this._globstar;

      case "Question":
        return this._question;

      case "Text":
        return escapeRegexp( node.value );

      case "Range":
        return this.genRange( node );

      case "PatternList":
        return this.genList( node );

      case "Pattern":
        return this.genPattern( node );

      case "Parameter":
        return this.genParameter( node );

      default:
        throw new TypeError( node.type );
    }

  },

  genSlash() {
    return this.allowDots ? "\\/" : "\\/(?!\\.)";
  },

  genSpecialSlash() {
    return "(?:" + this.genSlash() + "(?=.)|(?=\\/|$))";
  },

  genRange( node ) {
    return "[" + node.expression + "]";
  },

  genParameter( node ) {

    const modifier = node.modifier;
    const list = node.expression;
    const name = node.name;

    if ( name ) {
      this.names.push( name );
    }

    const pattern = list ? ( list.type === "Pattern" ? this.genPattern( list ) : this.genList( list ) ) : DEFAULT_GROUP;

    return this.processToken(
      name,
      modifier === "!",
      modifier === "*" || modifier === "**" || modifier === "?",
      modifier === "*" || modifier === "**" || modifier === "+",
      modifier === "**",
      pattern
    );

  },

  genPattern( pattern ) {

    const body = pattern.body;
    let str = "";

    for ( let i = 0; i < body.length; i++ ) {

      const node = body[ i ];

      if ( node.type === "Slash" ) {

        const next = body[ i + 1 ];

        if ( !next ) {
          break;
        }

        if ( next.type === "Slash" ) {
          continue;
        }

        str += next.type === "Text" ? this.genSlash() : this.genSpecialSlash();

      } else {
        str += this.generator( node );
      }

    }

    return str;
  },

  genList( node ) {

    const patterns = node.patterns;
    const len = patterns.length;

    let str = this.generator( patterns[ 0 ] );

    for ( let i = 1; i < len; i++ ) {
      str += "|" + this.generator( patterns[ i ] );
    }

    return "(?:" + str + ")";

  },

  processToken( name, negated, optional, repeat, recursive, pattern ) {

    let capture = pattern;

    if ( negated ) {
      // TODO better negation
      capture = "(?!" + capture + "(?=\\/|$))" + DEFAULT_GROUP;
    }

    if ( repeat ) {
      capture += recursive ? "(?:" + this.genSlash() + capture + ")*" : "(?:" + capture + ")*";
    }

    if ( optional ) {
      if ( name ) {
        return "(" + capture + ")?";
      }
      return "(?:" + capture + ")?";
    }

    if ( name ) {
      return "(" + capture + ")";
    }

    return capture;
  }

};

function getBase( body ) {
  let base = "";

  for ( let i = 0; i < body.length; i++ ) {
    const n = body[ i ];
    if ( n.type === "Slash" ) {
      base += "/";
    } else if ( n.type === "Text" ) {
      if ( !body[ i + 1 ] || body[ i + 1 ].type === "Slash" ) {
        base += n.value;
      }
    } else {
      break;
    }
  }

  return normalizePre( base );
}

function pathToRegexp( pattern, opts = {} ) {

  const negated = pattern.charCodeAt( 0 ) === EXCLAMATION_MARK_CODE;
  const base = opts.base === undefined ? true : opts.base;
  const end = opts.end === undefined ? true : opts.end;

  // TODO trim all initial !, !! is equal to none, !!! is equal to !

  const ast = PARSER_STATE.parse( negated ? pattern.slice( 1 ) : pattern );
  const regexp = GENERATOR.generate( ast, opts.dot );

  const lastToken = PARSER_STATE.lastToken;

  return {
    regexp: new RegExp( "^" + regexp + "(?:/(?=$))?" + ( end ? "$" : "(?=\\/|$)" ), opts.caseSensitive ? "" : "i" ),
    onlyMatchDir: lastToken != null && lastToken.value === "/",
    base: base ? getBase( ast.body ) : null,
    ast: opts.ast ? ast : null,
    names: GENERATOR.names,
    negated: negated
  };
}

export default pathToRegexp;
