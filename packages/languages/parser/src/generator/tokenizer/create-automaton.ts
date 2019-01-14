import { parse as parseRegexp } from "regexp-tree";
import {
  AstRegExp, Char, CharacterClass,
  Alternative, Group, Backreference,
  Repetition, Expression, Assertion
} from "regexp-tree/ast"; // eslint-disable-line import/no-unresolved
import { Automaton } from "../utils/automaton";
import {
  StringNode, RegexpNode, LexerRule,
  Id, OptionalOrRepetition, Options, Empty, Concat
} from "../grammar-parser";
import Grammar from "../grammar";
import { printLoc } from "../utils";

type Frag = {
  in: number;
  out: number;
};

class BasicGenerator {

  generator: Generator;

  constructor( generator: Generator ) {
    this.generator = generator;
  }

  // Char NFA fragment: `c`
  // [in] --c--> [out]
  char( code: number | null ) {
    const _in = this.generator.newState();
    const _out = this.generator.newState();
    if ( code == null ) {
      this.generator.addEpsilon( _in, _out );
    } else {
      this.generator.addNumber( _in, code, _out );
    }
    return { in: _in, out: _out };
  }

  // Epsilon NFA fragment
  // [in] --ε--> [out]
  e() {
    return this.char( null );
  }

  // Alteration NFA fragment: `abc`
  // [in-a] --a--> [out-a] --ε--> [in-b] --b--> [out-b]
  altPair( first: Frag, second: Frag ) {
    this.generator.addEpsilon( first.out, second.in );
    return { in: first.in, out: second.out };
  }

  // Creates a alteration NFA for (at least) two NFA-fragments.
  alt( first: Frag, ...fragments: Frag[] ) {
    for ( const fragment of fragments ) {
      first = this.altPair( first, fragment );
    }
    return first;
  }

  // Disjunction NFA fragment: `a|b`
  // Creates a disjunction choice between two fragments.
  orPair( first: Frag, second: Frag ) {
    const _in = this.generator.newState();
    const _out = this.generator.newState();

    this.generator.addEpsilon( _in, first.in );
    this.generator.addEpsilon( _in, second.in );

    this.generator.addEpsilon( first.out, _out );
    this.generator.addEpsilon( second.out, _out );

    return { in: _in, out: _out };
  }

  // Creates a disjunction NFA for (at least) two NFA-fragments.
  or( first: Frag, ...fragments: Frag[] ) {
    for ( let fragment of fragments ) {
      first = this.orPair( first, fragment );
    }
    return first;
  }

  // Optimized Kleene-star: just adds ε-transitions from input to the output, and back
  rep( fragment: Frag ) {
    this.generator.addEpsilon( fragment.in, fragment.out );
    this.generator.addEpsilon( fragment.out, fragment.in );
    return fragment;
  }

  // Optimized Plus: just adds ε-transitions from the output to the input
  plusRep( fragment: Frag ) {
    this.generator.addEpsilon( fragment.out, fragment.in );
    return fragment;
  }

  // Optimized ? repetition: just adds ε-transitions from the input to the output
  questionRep( fragment: Frag ) {
    this.generator.addEpsilon( fragment.in, fragment.out );
    return fragment;
  }

  gen( node: any ): Frag {
    if ( !node ) {
      throw new Error( "node is undefined" );
    }
    // @ts-ignore
    if ( !this[ node.type ] ) {
      throw new Error( `${node.type} is not supported` );
    }
    // @ts-ignore
    return this[ node.type ]( node );
  }

}

type Char2 = Char & { codePoint: number };

class RegexpGenerator extends BasicGenerator {

  Char( { codePoint, kind }: Char2 ) {
    if ( codePoint == null || Number.isNaN( codePoint ) ) {
      throw new Error( `Char of kind ${kind} is not supported` );
    }
    return this.char( codePoint );
  }

  CharacterClass( { negative, expressions }: CharacterClass ) {
    if ( negative ) {
      throw new Error( `Negative CharacterClass is not supported` );
    }
    const fragments = ( expressions || [] ).map( e => this.gen( e ) );
    // @ts-ignore
    return this.or( ...fragments );
  }

  ClassRange( { from, to }: { from: Char2; to: Char2 } ) {
    const _in = this.generator.newState();
    const _out = this.generator.newState();
    this.generator.addRange( _in, { from: from.codePoint, to: to.codePoint }, _out );
    return { in: _in, out: _out };
  }

  Alternative( { expressions }: Alternative ) {
    const fragments = ( expressions || [] ).map( e => this.gen( e ) );
    // @ts-ignore
    return this.alt( ...fragments );
  }

  Disjunction( { left, right }: { left: Expression; right: Expression } ) {
    return this.or( this.gen( left ), this.gen( right ) );
  }

  Group( { expression, capturing, name }: Group & { name?: string } ) {
    if ( capturing && name ) {
      throw new Error( `Named group capturing is not supported` );
    }
    return this.gen( expression );
  }

  Backreference( _: Backreference ) {
    throw new Error( `Backreferences are not supported` );
  }

  Repetition( { quantifier, expression }: Repetition ) {
    const { kind, greedy } = quantifier;
    if ( !greedy ) {
      throw new Error( `Non-greedy repetition is not supported` );
    }
    switch ( quantifier.kind ) {
      case "*":
        return this.rep( this.gen( expression ) );
      case "+":
        return this.plusRep( this.gen( expression ) );
      case "?":
        return this.questionRep( this.gen( expression ) );
      case "Range":
        if ( quantifier.from === 0 && quantifier.to == null ) {
          return this.rep( this.gen( expression ) );
        }
        if ( quantifier.from === 1 && quantifier.to == null ) {
          return this.plusRep( this.gen( expression ) );
        }
        if ( quantifier.from === 0 && quantifier.to === 1 ) {
          return this.questionRep( this.gen( expression ) );
        }
        // TODO more?
        throw new Error( `Repetition range {${quantifier.from},${quantifier.to || ""}} is not supported yet` );
      default:
        throw new Error( `Repetition of kind ${kind} is not supported` );
    }
  }

  Assertion( _: Assertion ) {
    throw new Error( `Assertions are not supported` );
  }

  RegExp( node: AstRegExp ) {
    if ( node.flags ) {
      throw new Error( "Flags are not supported yet" );
    }
    return this.gen( node.body );
  }

}

class LexerRuleGenerator extends BasicGenerator {

  LexerRule( node: LexerRule ) {
    return this.gen( node.rule );
  }

  Id( node: Id ) {
    const rule = this.generator.grammar.rules.get( node.name );
    if ( rule == null ) {
      throw new Error( `Rule ${node.name} is not defined (${printLoc( node )})` );
    }
    if ( rule.type === "ParserRule" ) {
      throw new Error( `Rule ${node.name} is a parser rule (${printLoc( node )})` );
    }
    return this.generator.lexerToFrag( rule );
  }

  Regexp( node: RegexpNode ) {
    return this.generator.regexpToFrag( node );
  }

  String( node: StringNode ) {
    return this.generator.stringToFrag( node );
  }

  Optional( node: OptionalOrRepetition & { type: "Optional" } ) {
    return this.questionRep( this.gen( node.item ) );
  }

  ZeroOrMore( node: OptionalOrRepetition & { type: "Optional" } ) {
    return this.rep( this.gen( node.item ) );
  }

  OneOrMore( node: OptionalOrRepetition & { type: "Optional" } ) {
    return this.plusRep( this.gen( node.item ) );
  }

  Options( node: Options ) {
    const fragments = ( node.options || [] ).map( e => this.gen( e ) );
    // @ts-ignore
    return this.or( ...fragments );
  }

  Empty( _: Empty ) {
    return this.e();
  }

  Concat( node: Concat ) {
    const fragments = ( node.body || [] ).map( e => this.gen( e ) );
    // @ts-ignore
    return this.alt( ...fragments );
  }

}

export type LexerTokens = StringNode | RegexpNode | LexerRule;

class Generator extends Automaton {

  grammar: Grammar;
  start: number;
  end: number;
  regexpGenerator: RegexpGenerator;
  lexerRuleGenerator: LexerRuleGenerator;
  lexerToFragCache: Map<LexerRule, Frag>;

  constructor( grammar: Grammar ) {
    super();
    this.grammar = grammar;
    this.start = this.newState();
    this.end = this.newState();
    this.regexpGenerator = new RegexpGenerator( this );
    this.lexerRuleGenerator = new LexerRuleGenerator( this );
    this.lexerToFragCache = new Map();
  }

  regexpToFrag( node: RegexpNode ) {
    return this.regexpGenerator.gen( parseRegexp( node.raw ) );
  }

  stringToFrag( node: StringNode ) {
    const _in = this.newState();
    let currentIn = _in;

    for ( const char of node.value ) {
      const currentOut = this.newState();
      const code = char.codePointAt( 0 ) as number;
      this.addNumber( currentIn, code, currentOut );
      currentIn = currentOut;
    }

    return {
      in: _in,
      out: currentIn
    };
  }

  addFromLiteral( node: StringNode | RegexpNode, finalTransition: number ) {
    let fragment;
    if ( node.type === "String" ) {
      fragment = this.stringToFrag( node );
    } else {
      fragment = this.regexpToFrag( node );
    }

    this.addEpsilon( this.start, fragment.in );
    this.addNumber( fragment.out, finalTransition, this.end );
  }

  lexerToFrag( node: LexerRule ) {
    const fragment = this.lexerToFragCache.get( node ) || this.lexerRuleGenerator.gen( node );
    this.lexerToFragCache.set( node, fragment );
    return fragment;
  }

  addFromLexerRule( node: LexerRule, finalTransition: number ) {
    const fragment = this.lexerToFrag( node );

    this.addEpsilon( this.start, fragment.in );
    this.addNumber( fragment.out, finalTransition, this.end );
  }

}

export default function createAutomaton( grammar: Grammar ) {
  const automaton = new Generator( grammar );
  const acceptingSet = new Set( [ automaton.end ] );

  const nodeToId: Map<LexerTokens, number> = new Map();
  const idToNode: Map<number, LexerTokens> = new Map();
  const transitionToNode: Map<number, LexerTokens> = new Map();

  const terminalRawToId = new Map();
  let terminalUUID = 1;

  for ( const node of grammar.terminals ) {
    const currId = terminalRawToId.get( node.raw );
    if ( currId != null ) {
      nodeToId.set( node, currId );
      continue;
    }

    const id = terminalUUID++;
    const finalTransition = -id;

    nodeToId.set( node, id );
    idToNode.set( id, node );
    transitionToNode.set( finalTransition, node );
    terminalRawToId.set( node.raw, id );

    automaton.addFromLiteral( node, finalTransition );
  }

  for ( const node of grammar.lexerRules.values() ) {
    if ( node.modifiers.fragment ) {
      continue;
    }

    const id = terminalUUID++;
    const finalTransition = -id;

    nodeToId.set( node, id );
    idToNode.set( id, node );
    transitionToNode.set( finalTransition, node );

    automaton.addFromLexerRule( node, finalTransition );
  }

  grammar.nodeToId = nodeToId;
  grammar.idToNode = idToNode;

  return {
    states: automaton.states,
    start: automaton.start,
    acceptingSet,
    nodeToId,
    transitionToNode
  };
}
