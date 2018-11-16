import { EPSILON } from "./utils";

const regexpTree = require( "regexp-tree" );

class Generator {

  constructor() {
    this.states = [ null ];
    this.alphabet = new Set();
    this.acceptingSet = new Set();
  }

  newState() {
    const id = this.states.length;
    const map = new Map();
    this.states.push( map );
    return id;
  }

  addTransition( a, symbol, b ) {
    let set = this.states[ a ].get( symbol );
    if ( !set ) {
      set = new Set();
      this.states[ a ].set( symbol, set );
    }
    set.add( b );

    if ( EPSILON !== symbol ) this.alphabet.add( symbol );
  }

  getNFA( spec ) {
    const start = this.newState();
    const end = this.newState();
    const acceptingSet = new Set( [ end ] );
    const labelToOrder = new Map();
    let order = 0;

    for ( const { label, regexp } of spec ) {
      labelToOrder.set( label, order++ );

      const ast = regexpTree.parse( regexp.toString() );
      const fragment = this.gen( ast );

      this.addTransition( start, EPSILON, fragment.in );
      this.addTransition( fragment.out, `_${label}`, end );
    }

    return {
      states: this.states,
      alphabet: this.alphabet,
      start,
      acceptingSet,
      labelToOrder
    };
  }

  // Helpers

  // Char NFA fragment: `c`
  // [in] --c--> [out]
  char( code ) {
    const _in = this.newState();
    const _out = this.newState();
    this.addTransition( _in, code, _out );
    return { in: _in, out: _out };
  }

  // Epsilon NFA fragment
  // [in] --ε--> [out]
  e() {
    return this.char( EPSILON );
  }

  // Alteration NFA fragment: `abc`
  // [in-a] --a--> [out-a] --ε--> [in-b] --b--> [out-b]
  altPair( first, second ) {
    this.addTransition( first.out, EPSILON, second.in );
    return { in: first.in, out: second.out };
  }

  // Creates a alteration NFA for (at least) two NFA-fragments.
  alt( first, ...fragments ) {
    for ( const fragment of fragments ) {
      first = this.altPair( first, fragment );
    }
    return first;
  }

  // Disjunction NFA fragment: `a|b`
  // Creates a disjunction choice between two fragments.
  orPair( first, second ) {
    const _in = this.newState();
    const _out = this.newState();

    this.addTransition( _in, EPSILON, first.in );
    this.addTransition( _in, EPSILON, second.in );

    this.addTransition( first.out, EPSILON, _out );
    this.addTransition( second.out, EPSILON, _out );

    return { in: _in, out: _out };
  }

  // Creates a disjunction NFA for (at least) two NFA-fragments.
  or( first, ...fragments ) {
    for ( let fragment of fragments ) {
      first = this.orPair( first, fragment );
    }
    return first;
  }

  // Optimized Kleene-star: just adds ε-transitions from input to the output, and back
  rep( fragment ) {
    this.addTransition( fragment.in, EPSILON, fragment.out );
    this.addTransition( fragment.out, EPSILON, fragment.in );
    return fragment;
  }

  // Optimized Plus: just adds ε-transitions from the output to the input
  plusRep( fragment ) {
    this.addTransition( fragment.out, EPSILON, fragment.in );
    return fragment;
  }

  // Optimized ? repetition: just adds ε-transitions from the input to the output
  questionRep( fragment ) {
    this.addTransition( fragment.in, EPSILON, fragment.out );
    return fragment;
  }

  // Each AST Node generators

  Char( { codePoint, kind } ) {
    if ( codePoint == null || Number.isNaN( codePoint ) ) {
      throw new Error( `Char of kind ${kind} is not supported` );
    }
    return this.char( codePoint );
  }

  CharacterClass( /* { negative, expressions }*/ ) {
    // expressions: (char|range)[]
    throw new Error( `CharacterClass is not supported` );
  }

  ClassRange( /* { from, to }*/ ) {
    // from: char, to: char
    throw new Error( `ClassRange is not supported` );
  }

  Alternative( { expressions } ) {
    const fragments = ( expressions || [] ).map( e => this.gen( e ) );
    return this.alt( ...fragments );
  }

  Disjunction( { left, right } ) {
    return this.or( this.gen( left ), this.gen( right ) );
  }

  Group( { expression, capturing, /* number,*/ name } ) {
    if ( capturing && name ) {
      throw new Error( `Named group capturing is not supported` );
    }
    return this.gen( expression );
  }

  Backreference( { kind, /* number, reference: name*/ } ) {
    switch ( kind ) {
      case "number":
      case "name":
      default:
        throw new Error( `Backreference of kind ${kind} is not supported` );
    }
  }

  Repetition( { quantifier, expression } ) {
    const { kind, greedy } = quantifier;
    if ( !greedy ) {
      throw new Error( `Non-greedy repetition of kind ${kind} is not supported` );
    }
    switch ( kind ) {
      case "*":
        return this.rep( this.gen( expression ) );
      case "+":
        return this.plusRep( this.gen( expression ) );
      case "?":
        return this.questionRep( this.gen( expression ) );
      case "Range":
        // quantifier.from: number, quantifier.to: number | undefined
        throw new Error( `Repetition of kind ${kind} is not supported` );
      default:
        throw new Error( `Repetition of kind ${kind} is not supported` );
    }
  }

  Assertion( { kind } ) {
    switch ( kind ) {
      case "^":
      case "$":
      case "\\b":
      case "\\B":
      case "Lookahead": // negative or not
      case "Lookbehind": // negative or not
      default:
        throw new Error( `Assertion of kind ${kind} is not supported` );
    }
  }

  RegExp( node ) {
    if ( node.flags ) {
      throw new Error( "Flags are not supported yet" );
    }
    return this.gen( node.body );
  }

  gen( node ) {
    if ( !node ) {
      throw new Error( "node is undefined" );
    }
    if ( !this[ node.type ] ) {
      throw new Error( `${node.type} is not supported` );
    }
    return this[ node.type ]( node );
  }

}

export default function regexpsToAutomaton( spec ) {
  return new Generator().getNFA( spec );
}
