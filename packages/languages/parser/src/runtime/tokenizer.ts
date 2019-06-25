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

export class Tokenizer<$Tokens extends Token, $Channels extends string> {

  input: string;
  inputLen: number;
  comments: Comment[];
  pos: number;
  current: number;
  _lineStart: number;
  _curLine: number;
  _start: Position;

  idToChannels: { [key: number]: $Channels[] };
  channels: { [key in $Channels]: $Tokens[] };

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

    this.idToChannels = {};
    // @ts-ignore
    this.channels = {};
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

  readToken(): $Tokens {
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

  nextToken(): $Tokens | typeof Tokenizer.EOF {
    while ( true ) {
      if ( this.pos >= this.inputLen ) {
        return Tokenizer.EOF;
      }

      this._start = this.curPosition();
      this.current = this.codeAt( this.pos );

      const t = this.readToken();

      const channels = this.idToChannels[ t.id ];
      if ( channels ) {
        for ( const chan of channels ) {
          this.channels[ chan ].push( t );
        }
        continue;
      }

      return t;
    }
  }

}
