import GrammarParser from "./grammar-parser";
import ConflictsHandler from "./conflicts-handler";
import generateParser from "./generate-parser";
import { reservedLabels } from "./generate-tokenizer";

export default class Grammar {

  constructor( terminals, rules ) {
    this.terminals = terminals;
    this.rules = new Map();
    this.ids = new Map();
    this.asString = "";
    this.conflictHandlers = [];

    for ( const name of Object.keys( terminals ) ) {
      if ( reservedLabels.has( name ) ) {
        throw new Error( `${name} is a reserved internal name.` );
      }
    }

    for ( const [ name, string ] of Object.entries( rules ) ) {
      if ( reservedLabels.has( name ) ) {
        throw new Error( `${name} is a reserved internal name.` );
      }
      if ( this.isTerminal( name ) ) {
        throw new Error( `${name} is already a name of a terminal. Don't use it as a name of a rule.` );
      }
      this.rules.set( name, new GrammarParser( this.ids, string ).parse( name ) );
      this.asString += `${name} := ${string}\n`;
      if ( !this.firstRule ) {
        this.firstRule = this.rules.get( name );
      }
    }
  }

  toString() {
    return this.asString;
  }

  isTerminal( x ) {
    return !!this.terminals[ x ];
  }

  isVariable( x ) {
    return this.rules.has( x );
  }

  getRule( name ) {
    return this.rules.get( name ) || ( () => { throw new Error( `No rule named ${name} was found` ); } )();
  }

  createConflictHandler( parentNode ) {
    const c = new ConflictsHandler( parentNode );
    this.conflictHandlers.push( c );
    return c;
  }

  reportConflicts() {
    const reports = [];
    for ( const handler of this.conflictHandlers ) {
      const report = handler.report();
      if ( report ) {
        reports.push( report );
      }
    }
    return reports;
  }

  first( node, set = new Set(), stack = new Set() ) {
    const f = node => {
      switch ( node.type ) {
        case "Rule":
          return f( node.rule );
        case "Options":
          return node.options.map( f ).some( x => x );
        case "Concat":
          return node.body.every( f );
        case "Optional":
        case "ZeroOrMore":
          f( node.item );
          return true;
        case "OneOrMore":
          return f( node.item );
        case "Id": {
          if ( this.isTerminal( node.name ) ) {
            set.add( node.name );
            return false;
          }
          if ( stack.has( node.name ) ) {
            throw new Error( `Left recursion on ${node.name}` );
          }
          stack.add( node.name );
          const result = f( this.getRule( node.name ) );
          stack.delete( node.name );
          return result;
        }
        case "Named":
          return f( node.item );
        default:
          throw new Error( `Unexpected node: ${node.type}` );
      }
    };
    return {
      set,
      canBeEmpty: f( node )
    };
  }

  findRoot( node ) {
    while ( node.parent ) {
      node = node.parent;
    }
    return node;
  }

  follow( node, set = new Set() ) {
    if ( node.parent ) {

      let canBeEmpty = true;
      let sibling = node.nextSibling;

      while ( sibling && canBeEmpty ) {
        canBeEmpty = this.first( sibling, set ).canBeEmpty;
        sibling = sibling.nextSibling;
      }

      if ( canBeEmpty ) {
        this.follow( this.findRoot( node ), set );
      }
    } else {
      // "node" is a rule
      for ( const n of this.nameUsedIn( node.name ) ) {
        this.follow( n, set );
      }
    }
    return set;
  }

  lookahead( node, set = new Set() ) {
    if ( this.first( node, set ).canBeEmpty ) {
      this.follow( node, set );
    }
    if ( set.size === 0 ) {
      throw new Error( "Assertion error: empty lookahead set?" );
    }
    return set;
  }

  // Returns an array of "id nodes" with name "name"
  nameUsedIn( name ) {
    if ( this.isTerminal( name ) ) {
      throw new Error( `${name} is a terminal` );
    }
    if ( !this.isVariable( name ) ) {
      throw new Error( `No rule named ${name} was found` );
    }
    return this.ids.get( name ) || [];
  }

  generate() {
    return generateParser( this );
  }

}
