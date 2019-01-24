import { error } from "./error";

/* eslint default-case: 0, no-fallthrough: 0 */

export type Token = {
  id: number;
  label: string;
  image: string;
};

export type Position = {
  pos: number;
  line: number;
  column: number;
};

export type Location = {
  start: Position;
  end: Position;
};

export type Comment = {
  type: "CommentBlock" | "CommentLine";
  value: string;
  loc: Location;
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

export class Tokenizer {

  input: string;
  inputLen: number;
  comments: Comment[];
  pos: number;
  current: number;
  _lineStart: number;
  _curLine: number;
  _start: Position;

  static EOF: { id: 0; label: "EOF"; image: string } = { id: 0, label: "EOF", image: "" };

  constructor( input: string ) {
    this.input = input;
    this.inputLen = input.length;
    this.comments = [];
    this.pos = 0;
    this.current = this.codeAt( this.pos );
    this._lineStart = 0;
    this._curLine = 1;
    this._start = this.curPosition();
  }

  unexpected() {
    throw error( `Unexpected character code ${this.current}`, this._start );
  }

  curPosition(): Position {
    return {
      pos: this.pos,
      line: this._curLine,
      column: this.pos - this._lineStart
    };
  }

  loc(): Location {
    return {
      start: this._start,
      end: this.curPosition()
    };
  }

  nextLine() {
    this._lineStart = this.pos;
    this._curLine++;
  }

  // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/codePointAt
  // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
  codeAt( index: number ) {
    if ( index >= this.input.length ) {
      return -1;
    }

    const first = this.input.charCodeAt( index );
    const size = this.input.length;
    if (
      first >= 0xD800 && first <= 0xDBFF &&
      size > index + 1
    ) {
      const second = this.input.charCodeAt( index + 1 );
      if ( second >= 0xDC00 && second <= 0xDFFF ) {
        return ( first - 0xD800 ) * 0x400 + second - 0xDC00 + 0x10000;
      }
    }
    return first;
  }

  readToken(): Token {
    throw new Error( "Abstract" );
  }

  next() {
    if ( this.current > 0xffff ) {
      this.pos += 2;
    } else {
      this.pos++;
    }
    this.current = this.codeAt( this.pos );
  }

  consume1( code: number ) {
    const current = this.current;
    if ( current === code ) {
      this.next();
      return current;
    }
    this.unexpected();
  }

  consume2( a: number, b: number ) {
    const current = this.current;
    if ( a <= current && current <= b ) {
      this.next();
      return current;
    }
    this.unexpected();
  }

  nextToken(): Token {
    this.performSkip();
    this._start = this.curPosition();
    this.current = this.codeAt( this.pos );
    return this.pos >= this.inputLen ? Tokenizer.EOF : this.readToken();
  }

  isNewLine( code: number ): boolean {
    return code === 10 || code === 13;
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

}
