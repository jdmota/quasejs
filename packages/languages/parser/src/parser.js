// @flow
import { type Position, type Location, Tokenizer } from "./tokenizer";
import { error } from "./error";

export class Parser<Token: { +label: string }> {

  +tokenizer: Tokenizer<Token>;
  token: Token;
  tokenLoc: Location;
  start: Position;
  lastTokenEnd: Position;
  lookaheadState: ?{ token: Token, loc: Location };

  constructor( tokenizer: Tokenizer<Token> ) {
    this.tokenizer = tokenizer;
    this.start = { pos: 0, line: 0, column: 0 };
    this.lastTokenEnd = this.start;
    this.token = this.tokenizer.nextToken();
    this.tokenLoc = this.tokenizer.loc();
    this.lookaheadState = null;
  }

  startNode(): Position {
    return this.tokenLoc.start;
  }

  endNode(): Position {
    return this.lastTokenEnd;
  }

  locNode( start: Position ): Location {
    return {
      start,
      end: this.endNode()
    };
  }

  error( message: string, pos: ?Position ) {
    throw error( message, pos || this.tokenLoc.start );
  }

  // Returns the next current token
  next(): Token {
    this.lastTokenEnd = this.tokenLoc.end;

    if ( this.lookaheadState ) {
      this.token = this.lookaheadState.token;
      this.tokenLoc = this.lookaheadState.loc;
      this.lookaheadState = null;
    } else {
      this.token = this.tokenizer.nextToken();
      this.tokenLoc = this.tokenizer.loc();
    }

    return this.token;
  }

  match( t: string | Token ): boolean {
    return typeof t === "string" ? this.token.label === t : this.token === t;
  }

  eat( t: string | Token ): Token | null {
    const token = this.token;
    if ( this.match( t ) ) {
      this.next();
      return token;
    }
    return null;
  }

  expect( t: string | Token ): Token {
    const token = this.eat( t );
    if ( token == null ) {
      throw this.error( `Unexpected token ${this.token.label}, expected ${typeof t === "string" ? t : t.label}` );
    }
    return token;
  }

  unexpected( t: ?Token ) {
    throw this.error( `Unexpected token ${this.token.label}${t ? `, expected ${t.label}` : ""}` );
  }

  lookahead(): Token {
    if ( !this.lookaheadState ) {
      this.lookaheadState = {
        token: this.tokenizer.nextToken(),
        loc: this.tokenizer.loc()
      };
    }
    return this.lookaheadState.token;
  }

  // noEmptyList == false
  // Allowed: [] => []
  // noEmptyList == true
  // Disallowed: []

  // Disallowed: [ , ]
  // Allowed: [ a, ] => [ a ]
  // Allowed: [ a, b ] => [ a, b ]
  parseList<T>(
    middle: Token,
    close: Token,
    each: ( { stop: boolean } ) => T,
    noEmptyList: ?boolean,
    ignoreLastConsume: ?boolean
  ): Array<T> {
    const elts = [];
    const step = { stop: false };
    let first = true;

    while ( !this.match( close ) ) {
      if ( first ) {
        first = false;
      } else {
        this.expect( middle );
        if ( this.match( close ) ) break;
      }

      elts.push( each( step ) );
      if ( step.stop ) {
        break;
      }
    }

    if ( noEmptyList && elts.length === 0 ) {
      throw this.unexpected();
    }

    if ( !ignoreLastConsume ) {
      this.expect( close );
    }

    return elts;
  }

  // Allowed: [] => []
  // Allowed: [ , ] => [ null, null ]
  // Allowed: [ a, ] => [ a, null ]
  // Allowed: [ a, b ] => [ a, b ]
  parseListWithEmptyItems<T>(
    middle: Token,
    close: Token,
    each: ( { stop: boolean } ) => T
  ): Array<T | null> {
    const elts = [];
    const step = { stop: false };
    let first = true;

    while ( !this.match( close ) ) {
      if ( first ) {
        first = false;
      } else {
        this.expect( middle );
        if ( this.match( close ) ) {
          elts.push( null );
          break;
        }
      }

      if ( this.match( middle ) ) {
        elts.push( null );
      } else {
        elts.push( each( step ) );
        if ( step.stop ) {
          break;
        }
      }
    }

    this.expect( close );
    return elts;
  }

  parse() {
    throw new Error( "Abstract" );
  }

}
