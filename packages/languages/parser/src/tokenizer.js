// @flow
import { error } from "./error";

/* eslint default-case: 0, no-fallthrough: 0 */

export type Position = {
  pos: number,
  line: number,
  column: number
};

export type Location = {
  start: Position,
  end: Position
};

export type Comment = {
  type: "CommentBlock" | "CommentLine",
  value: string,
  loc: Location
};

export const FAKE_LOC = {
  start: {
    pos: 0,
    line: 0,
    column: 0
  },
  end: {
    pos: 0,
    line: 0,
    column: 0
  }
};

const lineBreak = /\r\n?|\n/;
const lineBreakG = new RegExp( lineBreak.source, "g" );

export class Tokenizer<Token> {

  +input: string;
  +inputLen: number;
  +comments: Comment[];
  pos: number;
  _lineStart: number;
  _curLine: number;
  _start: Position;
  _lastToken: Token;
  _eof: Token;

  constructor( input: string ) {
    this.input = input;
    this.inputLen = input.length;
    this.comments = [];
    this.pos = 0;
    this._lineStart = 0;
    this._curLine = 1;
    this._start = this.curPosition();
    this._lastToken = this.initial();
    this._eof = this.eof();
  }

  error( message: string ) {
    throw error( message, this._start );
  }

  unexpectedChar() {
    throw this.error( `Unexpected character '${this.charAt( this.pos )}'` );
  }

  getAllTokens(): Token[] {
    const tokens = [];
    while ( this._lastToken !== this._eof ) {
      tokens.push( this.nextToken() );
    }
    return tokens;
  }

  getComments(): Comment[] {
    return this.comments;
  }

  currToken(): Token {
    return this._lastToken;
  }

  curPosition(): Position {
    return {
      pos: this.pos,
      line: this._curLine,
      column: this.pos - this._lineStart
    };
  }

  loc() {
    return {
      start: this._start,
      end: this.curPosition()
    };
  }

  nextLine() {
    this._lineStart = this.pos;
    this._curLine++;
  }

  codeAt( pos: number ) {
    return this.input.charCodeAt( pos );
  }

  charAt( pos: number ) {
    return this.input.charAt( pos );
  }

  initial(): Token {
    throw new Error( "Abstract" );
  }

  eof(): Token {
    throw new Error( "Abstract" );
  }

  identifier( _word: string ): Token {
    throw new Error( "Abstract" );
  }

  readToken(): Token {
    throw new Error( "Abstract" );
  }

  nextToken(): Token {
    this.performSkip();
    this._start = this.curPosition();
    if ( this.pos >= this.inputLen ) {
      this._lastToken = this._eof;
    } else {
      this._lastToken = this.readToken();
    }
    return this._lastToken;
  }

  isNewLine( code: number ): boolean {
    return code === 10 || code === 13;
  }

  isIdentifierStart( code: number ): boolean {
    if ( code < 65 ) return code === 36; // 36 -> $
    if ( code < 91 ) return true; // 65-90 -> A-Z
    if ( code < 97 ) return code === 95; // 95 -> _
    if ( code < 123 ) return true; // 97-122 -> a-z
    return false;
  }

  isIdentifierChar( code: number ): boolean {
    if ( code < 48 ) return code === 36; // 36 -> $
    if ( code < 58 ) return true; // 48-57 -> 0-9
    return this.isIdentifierStart( code );
  }

  consumeNewLine(): number {
    const start = this.pos;
    const code = this.codeAt( this.pos );
    switch ( code ) {
      case 13: // '\r' carriage return
        // If the next char is '\n', move to pos+1 and let the next branch handle it
        if ( this.codeAt( this.pos + 1 ) === 10 ) {
          this.pos++;
        }
      case 10: // '\n' line feed
        this.pos++;
        this.nextLine();
    }
    return this.pos - start;
  }

  skip(): boolean {
    const code = this.codeAt( this.pos );
    switch ( code ) {
      case 13: // '\r' carriage return
        // If the next char is '\n', move to pos+1 and let the next branch handle it
        if ( this.codeAt( this.pos + 1 ) === 10 ) {
          this.pos++;
        }
      case 10: // '\n' line feed
        this.pos++;
        this.nextLine();
        return true;
      case 9: // horizontal tab
      case 12: // form feed
      case 32: // space
        this.pos++;
        return true;

      case 47: // '/'
        switch ( this.codeAt( this.pos + 1 ) ) {
          case 42: // '*'
            this.skipBlockComment();
            return true;
          case 47:
            this.skipLineComment();
            return true;
        }
    }
    return false;
  }

  performSkip(): void {
    while ( this.pos < this.inputLen ) {
      if ( !this.skip() ) {
        break;
      }
    }
  }

  skipLineComment(): void {
    const start = this.curPosition();

    let ch = this.codeAt( ( this.pos += 2 ) );
    if ( this.pos < this.inputLen ) {
      while ( !this.isNewLine( ch ) && ++this.pos < this.inputLen ) {
        ch = this.codeAt( this.pos );
      }
    }

    this.pushComment(
      false,
      this.input.slice( start.pos + 2, this.pos ),
      start,
      this.curPosition()
    );
  }

  skipBlockComment(): void {
    const start = this.curPosition();

    const end = this.input.indexOf( "*/", ( this.pos += 2 ) );
    if ( end === -1 ) {
      throw new Error( "Unterminated comment" );
    }
    this.pos = end + 2;

    const comment = this.input.slice( start.pos + 2, end );

    lineBreakG.lastIndex = start.pos;

    let match;
    while (
      ( match = lineBreakG.exec( this.input ) ) &&
      match.index < this.pos
    ) {
      this._curLine++;
      this._lineStart = match.index + match[ 0 ].length;
    }

    this.pushComment(
      true,
      comment,
      start,
      this.curPosition()
    );
  }

  pushComment( block: boolean, value: string, start: Position, end: Position ) {
    this.comments.push( {
      type: block ? "CommentBlock" : "CommentLine",
      value,
      loc: {
        start,
        end
      }
    } );
  }

  readWord(): string {
    const start = this.pos;
    while ( this.pos < this.inputLen ) {
      if ( this.isIdentifierChar( this.codeAt( this.pos ) ) ) {
        this.pos++;
      } else {
        break;
      }
    }
    return this.input.slice( start, this.pos );
  }

  readIdentifier(): Token {
    return this.identifier( this.readWord() );
  }

}
