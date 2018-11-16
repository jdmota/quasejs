// @flow
import { type Token, type IdentifierToken, type KeywordToken, tokens as tt, keywords } from "./tokens";
import { Tokenizer as BaseTokenizer } from "@quase/parser";

type Context = "string" | "stringBackQuote" | "left" | null;

export class Tokenizer extends BaseTokenizer<Token> {

  context: Context[];

  constructor( input: string ) {
    super( input );
    this.context = [];

    if ( this.charAt( 0 ) === "#" && this.charAt( 1 ) === "!" ) {
      this.skipLineComment();
    }
  }

  currContext() {
    return this.context[ this.context.length - 1 ];
  }

  initial(): Token {
    return {
      label: ""
    };
  }

  eof(): Token {
    return tt.eof;
  }

  identifier( value: string ): IdentifierToken | KeywordToken {
    return keywords[ value ] || {
      label: "identifier",
      value
    };
  }

  skip(): boolean {
    const ctx = this.currContext();
    if ( ctx === "string" || ctx === "stringBackQuote" ) {
      return false;
    }
    return super.skip();
  }

  readToken(): Token {
    const token = this._readToken();
    switch ( token ) {
      case tt.quote:
        if ( this.currContext() === "string" ) {
          this.context.pop();
        } else {
          this.context.push( "string" );
        }
        break;
      case tt.backQuote:
        if ( this.currContext() === "stringBackQuote" ) {
          this.context.pop();
        } else {
          this.context.push( "stringBackQuote" );
        }
        break;
      case tt.parenL:
      case tt.braceL:
      case tt.dollarBraceL:
        this.context.push( "left" );
        break;
      case tt.parenR:
      case tt.braceR:
        this.context.pop();
        break;
    }
    return token;
  }

  _readToken(): Token {
    const ctx = this.currContext();
    if ( ctx === "string" || ctx === "stringBackQuote" ) {
      return this.readTmplToken( ctx === "stringBackQuote" );
    }

    const code = this.codeAt( this.pos );

    switch ( code ) {
      case 35: // '#'
        return this.readHash();

      case 46: // '.'
        return this.readDot();

      // Punctuation tokens.
      case 40:
        this.pos++;
        return tt.parenL;
      case 41:
        this.pos++;
        return tt.parenR;
      case 59:
        this.pos++;
        return tt.semi;
      case 44:
        this.pos++;
        return tt.comma;
      case 91:
        this.pos++;
        return tt.bracketL;
      case 93:
        this.pos++;
        return tt.bracketR;

      case 123:
        if ( this.codeAt( this.pos + 1 ) === 124 ) {
          this.pos += 2;
          return tt.braceBarL;
        }
        this.pos++;
        return tt.braceL;

      case 125:
        this.pos++;
        return tt.braceR;

      case 58:
        if ( this.codeAt( this.pos + 1 ) === 58 ) {
          this.pos += 2;
          return tt.doubleColon;
        }
        this.pos++;
        return tt.colon;

      case 63:
        return this.readQuestion();

      case 64:
        this.pos++;
        return tt.at;

      case 96: // '`'
        this.pos++;
        return tt.backQuote;

      case 48: { // '0'
        const next = this.codeAt( this.pos + 1 );
        if ( next === 120 || next === 88 ) return this.readRadixNumber( 16 ); // '0x', '0X' - hex number
        if ( next === 111 || next === 79 ) return this.readRadixNumber( 8 ); // '0o', '0O' - octal number
        if ( next === 98 || next === 66 ) return this.readRadixNumber( 2 ); // '0b', '0B' - binary number
      }
      // Anything else beginning with a digit is an integer, number, or float.
      case 49:
      case 50:
      case 51:
      case 52:
      case 53:
      case 54:
      case 55:
      case 56:
      case 57: // 1-9
        return this.readNumber();

      case 34: // '"'
        this.pos++;
        return tt.quote;

      case 36: {
        // '${'
        if ( this.codeAt( this.pos + 1 ) === 123 ) {
          this.pos += 2;
          return tt.dollarBraceL;
        }
      }

      case 39: // "'"
        return this.readChar();

      case 47: // '/'
        return this.readSlash();

      case 37:
      case 42: // '%*'
        return this.readMultModulo( code );

      case 124:
      case 38: // '|&'
        return this.readPipeAmp( code );

      case 94: // '^'
        return this.readCaret();

      case 43:
      case 45: // '+-'
        return this.readPlusMin( code );

      case 60:
      case 62: // '<>'
        return this.readLtGt( code );

      case 61:
      case 33: // '=!'
        return this.readEqExcl( code );

      case 126: // '~'
        this.pos++;
        return tt.tilde;
    }

    if ( this.isIdentifierStart( code ) ) {
      return this.readIdentifier();
    }

    throw this.unexpectedChar();
  }

  readHash(): Token {
    const next = this.codeAt( this.pos + 1 );
    if ( next === 47 ) { // #/
      this.pos += 2;
      return this.readRegexp();
    }
    this.pos++;
    return tt.hash;
  }

  readDot(): Token {
    const next = this.codeAt( this.pos + 1 );
    const next2 = this.codeAt( this.pos + 2 );
    if ( next === 46 && next2 === 46 ) {
      // 46 = dot '.'
      this.pos += 3;
      return tt.ellipsis;
    }
    this.pos++;
    return tt.dot;
  }

  readQuestion(): Token {
    // '?'
    const next = this.codeAt( this.pos + 1 );
    if ( next === 46 ) {
      // '.'
      this.pos += 2;
      return tt.questionDot;
    }
    if ( next === 91 ) {
      // '['
      this.pos += 2;
      return tt.questionBracketL;
    }
    if ( next === 40 ) {
      // '('
      this.pos += 2;
      return tt.questionParenL;
    }
    this.pos++;
    return tt.question;
  }

  readSlash(): Token {
    // '/'
    const next = this.codeAt( this.pos + 1 );
    if ( next === 61 ) {
      this.pos += 2;
      return {
        label: "_=",
        isAssign: true,
        op: "/"
      };
    }
    this.pos++;
    return tt.slash;
  }

  readMultModulo( code: number ): Token {
    // '%*'
    let token;
    let op;
    let next = this.codeAt( this.pos + 1 );

    if ( code === 42 ) { // "*"

      op = "*";
      token = tt.star;

      if ( next === 42 ) {
        // '*'
        op = "**";
        next = this.codeAt( this.pos + 2 );
        token = tt.exponent;
      }

    } else { // "%"

      op = "%";
      token = tt.modulo;

    }

    if ( next === 61 ) {
      this.pos += op.length + 1;
      return {
        label: "_=",
        isAssign: true,
        op
      };
    }

    this.pos += op.length;
    return token;
  }

  readPipeAmp( code: number ): Token {
    // '|&'
    const next = this.codeAt( this.pos + 1 );
    if ( next === code ) {
      this.pos += 2;
      return code === 124 ? tt.logicalOR : tt.logicalAND;
    }
    if ( next === 61 ) {
      this.pos += 2;
      return {
        label: "_=",
        isAssign: true,
        op: code === 124 ? "|" : "&"
      };
    }
    if ( code === 124 && next === 125 ) {
      this.pos += 2;
      return tt.braceBarR;
    }
    this.pos++;
    return code === 124 ? tt.bitwiseOR : tt.bitwiseAND;
  }

  readCaret(): Token {
    // '^'
    const next = this.codeAt( this.pos + 1 );
    if ( next === 61 ) {
      this.pos += 2;
      return {
        label: "_=",
        isAssign: true,
        op: "^"
      };
    }
    this.pos++;
    return tt.bitwiseXOR;
  }

  readPlusMin( code: number ): Token {
    // '+-'
    const next = this.codeAt( this.pos + 1 );

    if ( next === code ) {
      this.pos += 2;
      return code === 43 ? tt.inc : tt.dec;
    }

    if ( next === 61 ) {
      this.pos += 2;
      return {
        label: "_=",
        isAssign: true,
        op: code === 43 ? "+" : "-"
      };
    }

    this.pos++;
    return code === 43 ? tt.plus : tt.minus;
  }

  readLtGt( code: number ): Token {
    // '<>'
    const next = this.codeAt( this.pos + 1 );

    if ( next === code ) {
      const size = code === 62 && this.codeAt( this.pos + 2 ) === 62 ? 3 : 2;
      if ( this.codeAt( this.pos + size ) === 61 ) {
        this.pos += size + 1;
        return {
          label: "_=",
          isAssign: true,
          op: code === 60 ? "<<" : size === 3 ? ">>>" : ">>"
        };
      }
      this.pos += size;
      return code === 60 ? tt.leftShift : size === 3 ? tt.zeroRightShift : tt.signRightShift;
    }

    if ( next === 61 ) {
      this.pos += 2;
      return code === 60 ? tt.lessEqual : tt.greaterEqual;
    }

    this.pos++;
    return code === 60 ? tt.less : tt.greater;
  }

  readEqExcl( code: number ): Token {
    // '=!'
    const next = this.codeAt( this.pos + 1 );

    if ( code === 33 ) { // "!"
      if ( next === 105 ) { // "i"
        const next3 = this.codeAt( this.pos + 3 );
        if ( this.isIdentifierChar( next3 ) ) {
          this.pos++;
          return tt.bang;
        }
        const next2 = this.codeAt( this.pos + 2 );
        if ( next2 === 115 ) { // "s"
          this.pos += 3;
          return tt.isNot;
        }
        if ( next2 === 110 ) { // "n"
          this.pos += 3;
          return tt.inNot;
        }
      }
    }

    if ( next === 61 ) {
      const size = this.codeAt( this.pos + 2 ) === 61 ? 3 : 2;
      this.pos += size;
      return code === 61 ?
        ( size === 3 ? tt.strictEquals : tt.equals ) :
        ( size === 3 ? tt.strictNotEquals : tt.notEquals );
    }

    if ( code === 61 && next === 62 ) {
      // '=>'
      this.pos += 2;
      return tt.arrow;
    }

    this.pos++;
    return code === 61 ? tt.eq : tt.bang;
  }

  readTmplToken( isBackQuote: boolean ): Token {
    const start = this.pos;
    let out = "";
    let chunkStart = start;

    while ( true ) {

      if ( this.pos >= this.inputLen ) {
        throw this.error( "Unterminated string" );
      }

      const ch = this.codeAt( this.pos );

      if (
        // '`'
        ( isBackQuote && ch === 96 ) ||
        // '"'
        ( !isBackQuote && ch === 34 ) ||
        // '${'
        ( ch === 36 && this.codeAt( this.pos + 1 ) === 123 )
      ) {

        if ( this.pos === start && this.currToken().label === "template" ) {
          if ( ch === 36 ) {
            this.pos += 2;
            return tt.dollarBraceL;
          }
          if ( ch === 96 ) {
            this.pos++;
            return tt.backQuote;
          }
          this.pos++;
          return tt.quote;
        }

        out += this.input.slice( chunkStart, this.pos );
        return {
          label: "template",
          raw: out
        };
      }

      // '\'
      if ( ch === 92 ) {

        out += this.input.slice( chunkStart, this.pos );
        this.pos++;

        out += this.readEscapedChar();

        chunkStart = this.pos;

      } else if ( !this.consumeNewLine() ) {
        this.pos++;
      }
    }

    // istanbul ignore next
    throw new Error( "Unreachable" ); // eslint-disable-line no-unreachable
  }

  readEscapedChar(): string {
    const ch = this.codeAt( this.pos );
    this.pos++;
    switch ( ch ) {
      case 110:
        return "\n"; // 'n' -> '\n'
      case 114:
        return "\r"; // 'r' -> '\r'
      case 116:
        return "\t"; // 't' -> '\t'
      case 98:
        return "\b"; // 'b' -> '\b'
      case 118:
        return "\u000b"; // 'v' -> '\u000b'
      case 102:
        return "\f"; // 'f' -> '\f'
      case 13:
        if ( this.codeAt( this.pos ) === 10 ) this.pos++; // '\r\n'
      case 10: // '\n'
        this.nextLine();
        return "";
      case 117: {
        // 'u'
        return String.fromCharCode( this.readCodePoint() );
      }
      default:
        return String.fromCharCode( ch );
    }
  }

  readCodePoint(): number {
    const ch = this.codeAt( this.pos );
    let code;

    // '{'
    if ( ch === 123 ) {
      code = this.readInt( 16, this.input.indexOf( "}", this.pos ) - this.pos );
    } else {
      code = this.readInt( 16, 4 );
    }
    return code;
  }

  readInt( radix: number, len: ?number ): number {
    const start = this.pos;
    let total = 0;

    for ( let i = 0, e = len == null ? Infinity : len; i < e; i++ ) {
      const code = this.codeAt( this.pos );

      if ( code === 95 ) {
        // Ignore '_'
        this.pos++;
        continue;
      }

      let val;
      if ( code >= 97 ) {
        val = code - 97 + 10; // a
      } else if ( code >= 65 ) {
        val = code - 65 + 10; // A
      } else if ( code >= 48 && code <= 57 ) {
        val = code - 48; // 0-9
      } else {
        val = Infinity;
      }
      if ( val >= radix ) break;
      this.pos++;
      total = total * radix + val;
    }

    if ( this.pos === start || ( len != null && this.pos - start !== len ) ) {
      throw new Error( "Invalid" ); // TODO
    }

    return total;
  }

  readRadixNumber( radix: number ): Token {

    const start = this.pos;
    let isBigInt = false;

    this.pos += 2; // 0x

    this.readInt( radix );

    if ( this.codeAt( this.pos ) === 0x6e ) { // bigInt
      // 'n'
      this.pos++;
      isBigInt = true;
    }

    if ( this.isIdentifierStart( this.codeAt( this.pos ) ) ) {
      throw this.error( "Identifier directly after number" );
    }

    return {
      label: "number",
      integer: true,
      bigint: isBigInt,
      float: false,
      radix,
      raw: this.input.slice( start, this.pos )
    };
  }

  readNumber(): Token {
    const start = this.pos;
    let isFloat = false;
    let isBigInt = false;

    this.readInt( 10 );

    let next = this.codeAt( this.pos );
    if ( this.currToken() !== tt.dot && next === 0x2e ) {
      // '.'
      this.pos++;
      this.readInt( 10 );
      isFloat = true;
      next = this.codeAt( this.pos );
    }

    if ( ( next === 0x45 || next === 0x65 ) ) {
      // 'Ee'
      next = this.codeAt( ++this.pos );
      if ( next === 0x2b || next === 0x2d ) this.pos++; // '+-'
      isFloat = true;
      this.readInt( 10 );
      next = this.codeAt( this.pos );
    }

    if ( next === 0x6e ) { // bigInt
      // 'n'
      // disallow floats
      if ( isFloat ) throw this.error( "Invalid BigIntLiteral" );
      this.pos++;
      isBigInt = true;
    }

    // TODO parse f, l, F, L for float and long? or create something new like 264bit32?

    if ( this.isIdentifierStart( this.codeAt( this.pos ) ) ) {
      throw this.error( "Identifier directly after number" );
    }

    return {
      label: "number",
      integer: !isFloat,
      bigint: isBigInt,
      float: isFloat,
      radix: 10,
      raw: this.input.slice( start, this.pos )
    };
  }

  readChar(): Token {
    const start = this.pos;
    let c = this.input.charAt( ++this.pos );

    if ( this.pos >= this.inputLen ) {
      throw this.error( "Unterminated char" );
    }

    if ( c === "'" ) {
      c = "";
    } else {
      if ( this.isNewLine( c.charCodeAt( 0 ) ) ) {
        throw this.error( "Unterminated char" );
      }

      this.pos++;

      if ( c === "\\" ) {
        c = this.readEscapedChar();
      }

      if ( this.codeAt( this.pos ) !== 39 ) { // "'"
        throw this.error( "Unterminated char" );
      }
    }

    this.pos++;
    return {
      label: "char",
      value: c,
      raw: this.input.slice( start, this.pos )
    };
  }

  readRegexp(): Token {
    const start = this.pos - 2;
    let escaped, inClass;

    while ( true ) {
      if ( this.pos >= this.inputLen ) {
        throw this.error( "Unterminated regular expression" );
      }
      const c = this.codeAt( this.pos );
      if ( this.isNewLine( c ) ) {
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
          break;
        }
        escaped = c === 92; // "\\"
      }
      this.pos++;
    }

    const pattern = this.input.slice( start + 2, this.pos );
    this.pos++;

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

}
