import { Parser } from "../parser";
import { Tokenizer } from "../tokenizer";

const firstChar = /[$_a-z]/i;
const idChars = /[$_0-9a-z]/i;

class GrammarTokenizer extends Tokenizer {

  initial() {
    return {
      label: "initial"
    };
  }

  eof() {
    return {
      label: "eof"
    };
  }

  identifier( word ) {
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

  readToken() {
    const char = this.charAt( this.pos );

    if ( firstChar.test( char ) ) {
      return this.readIdentifier();
    }

    switch ( char ) {
      case "(":
      case ")":
      case "|":
      case "?":
      case "*":
      case "+":
      case ":":
        this.pos++;
        return {
          label: char
        };
      default:
    }

    throw this.unexpectedChar();
  }

}

function connectAstNodes( node, parent, scope, hasMultiplicity, nextSibling ) {
  switch ( node.type ) {
    case "Rule":
      node.names = {};
      connectAstNodes( node.rule, node, node, false, null );
      break;
    case "Options": {
      const originalNames = scope.names;
      const names = { ...originalNames };
      for ( const opt of node.options ) {
        scope.names = { ...originalNames };
        connectAstNodes( opt, node, scope, hasMultiplicity, nextSibling );
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
        connectAstNodes( node.body[ i ], node, scope, hasMultiplicity, node.body[ i + 1 ] );
      }
      connectAstNodes( node.body[ lastIndex ], node, scope, hasMultiplicity, nextSibling );
      break;
    }
    case "Optional":
      connectAstNodes( node.item, node, scope, hasMultiplicity, nextSibling );
      break;
    case "ZeroOrMore":
    case "OneOrMore":
      connectAstNodes( node.item, node, scope, true, nextSibling );
      break;
    case "Id":
      break;
    case "Named":
      node.names = {};
      scope.names[ node.name ] = hasMultiplicity || scope.names[ node.name ] ? "array" : "single";
      connectAstNodes( node.item, node, node, false, nextSibling );
      break;
    default:
      throw new Error( `Unexpected node: ${node.type}` );
  }
  node.parent = parent;
  node.scope = scope;
  node.nextSibling = nextSibling;
  return node;
}

export default class GrammarParser extends Parser {

  constructor( ids, text ) {
    super( new GrammarTokenizer( text ) );
    this.ids = ids;
  }

  parseConcat( root ) {
    const start = this.startNode();
    const body = [];

    do {
      body.push( this.parseItem() );

      if ( !root ) {
        if ( this.match( "|" ) || this.match( ")" ) ) {
          break;
        }
      }
    } while ( !this.match( "eof" ) );

    return {
      type: "Concat",
      body,
      loc: this.locNode( start )
    };
  }

  parseGroup() {
    const start = this.startNode();
    const options = [];

    this.expect( "(" );

    do {
      options.push( this.parseConcat() );
    } while ( this.eat( "|" ) );

    this.expect( ")" );

    return {
      type: "Options",
      options,
      loc: this.locNode( start )
    };
  }

  parseItem() {
    const start = this.startNode();
    let item;

    if ( this.match( "id" ) && this.lookahead().label === ":" ) {
      const name = this.token.word;
      this.next();
      this.next();
      item = {
        type: "Named",
        name,
        item: this.parseAtom(),
        loc: this.locNode( start )
      };
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

  parseAtom() {
    return this.match( "(" ) ? this.parseGroup() : this.parseId();
  }

  parseId() {
    const start = this.startNode();
    const name = this.expect( "id" ).word;
    const item = {
      type: "Id",
      name,
      loc: this.locNode( start )
    };
    const arr = this.ids.get( name ) || [];
    arr.push( item );
    this.ids.set( name, arr );
    return item;
  }

  _parse( name ) {
    const start = this.startNode();
    return {
      type: "Rule",
      name,
      rule: this.parseConcat( true ),
      loc: this.locNode( start )
    };
  }

  parse( name ) {
    return connectAstNodes( this._parse( name ), null, null, false, null );
  }

}
