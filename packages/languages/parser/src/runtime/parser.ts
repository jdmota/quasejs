import { Token, Position, Location, Tokenizer } from "./tokenizer";
import { error } from "./error";

export class Parser {

  tokenizer: Tokenizer;
  start: Position;
  lastTokenEnd: Position;
  token: Token;
  tokenLoc: Location;
  current: number;
  lastToken: Token;

  constructor( tokenizer: Tokenizer ) {
    this.tokenizer = tokenizer;
    this.start = { pos: 0, line: 0, column: 0 };
    this.lastTokenEnd = this.start;
    this.token = this.tokenizer.nextToken();
    this.tokenLoc = this.tokenizer.loc();
    this.current = this.token.id;
    this.lastToken = this.token;
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

  next() {
    this.lastTokenEnd = this.tokenLoc.end;
    this.token = this.tokenizer.nextToken();
    this.tokenLoc = this.tokenizer.loc();
    this.current = this.token.id;
  }

  consume1( id: number ) {
    const token = this.token;
    if ( token.id === id ) {
      this.next();
      this.lastToken = token;
      return token;
    }
    this.unexpected( id );
  }

  consume2( a: number, b: number ) {
    const token = this.token;
    if ( a <= token.id && token.id <= b ) {
      this.next();
      this.lastToken = token;
      return token;
    }
    this.unexpected( a );
  }

  unexpected( id?: number | string ) {
    throw error( `Unexpected token ${this.token.label}${id == null ? "" : `, expected ${id}`}`, this.tokenLoc.start );
  }

  parse() {
    throw new Error( "Abstract" );
  }

}
