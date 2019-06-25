import {
  StringNode, RegexpNode, LexerRule, Id, OptionalOrRepetition,
  Options, Empty, Concat, ParserRule, ActionNode, Named, Dot
} from "./parser/grammar-parser";
import { printLoc } from "./utils";
import Grammar, { LexerTokens } from "./grammar";
import { Automaton, Frag } from "./automaton";
import { FactoryRegexp, regexpToAutomaton } from "./factory-regexp";
import { RuleTransition, ActionTransition, TokenFinalTransition, NamedTransition, RangeTransition } from "./transitions";
import { MIN_CHAR, MAX_CHAR } from "./constants";

export class Factory {

  grammar: Grammar;
  inLexer: boolean;
  automaton: Automaton;
  factoryFromRegexp: FactoryRegexp;

  constructor( grammar: Grammar, inLexer: boolean ) {
    this.grammar = grammar;
    this.inLexer = inLexer;
    this.automaton = new Automaton();
    this.factoryFromRegexp = new FactoryRegexp( this.automaton );
  }

  ParserRule( node: ParserRule ) {
    return this.gen( node.rule );
  }

  LexerRule( node: LexerRule ) {
    return this.gen( node.rule );
  }

  Empty( _: Empty ) {
    return this.automaton.e();
  }

  Id( node: Id ) {
    const rule = this.grammar.rules.get( node.name );
    if ( rule == null ) {
      throw new Error( `Rule ${node.name} is not defined (${printLoc( node )})` );
    }
    if ( !this.inLexer && rule.type === "LexerRule" ) {
      return this._token( rule );
    }
    const start = this.automaton.newState();
    const end = this.automaton.newState();
    start.addTransition( new RuleTransition( rule ), end );
    return {
      in: start,
      out: end
    };
  }

  _token( node: LexerRule | RegexpNode | StringNode ) {
    const _in = this.automaton.newState();
    const _out = this.automaton.newState();
    const tokenId = this.grammar.nodeToId.get( node );
    if ( !tokenId ) {
      throw new Error( "Assertion error" );
    }
    _in.addNumber( tokenId, _out );
    return { in: _in, out: _out };
  }

  Dot( _node: Dot ) {
    const min = this.inLexer ? MIN_CHAR : this.grammar.minTokenId;
    const max = this.inLexer ? MAX_CHAR : this.grammar.maxTokenId;
    const _in = this.automaton.newState();
    const _out = this.automaton.newState();
    _in.addRange( min, max, _out );
    return {
      in: _in,
      out: _out
    };
  }

  Regexp( node: RegexpNode ) {
    if ( this.inLexer ) {
      return regexpToAutomaton( this.factoryFromRegexp, node );
    }
    return this._token( node );
  }

  String( node: StringNode ) {
    if ( this.inLexer ) {
      const _in = this.automaton.newState();
      let currentIn = _in;

      for ( const char of node.value ) {
        const currentOut = this.automaton.newState();
        const code = char.codePointAt( 0 ) as number;
        currentIn.addNumber( code, currentOut );
        currentIn = currentOut;
      }

      return {
        in: _in,
        out: currentIn
      };
    }
    return this._token( node );
  }

  Optional( node: OptionalOrRepetition & { type: "Optional" } ) {
    return this.automaton.question( this.gen( node.item ) );
  }

  ZeroOrMore( node: OptionalOrRepetition & { type: "ZeroOrMore" } ) {
    return this.automaton.rep( this.gen( node.item ) );
  }

  OneOrMore( node: OptionalOrRepetition & { type: "OneOrMore" } ) {
    return this.automaton.plusRep( this.gen( node.item ) );
  }

  Options( node: Options ) {
    const fragments = ( node.options || [] ).map( e => this.gen( e ) );
    // @ts-ignore
    return this.automaton.or( ...fragments );
  }

  Concat( node: Concat ) {
    const fragments = ( node.body || [] ).map( e => this.gen( e ) );
    // @ts-ignore
    return this.automaton.alteration( ...fragments );
  }

  Action( node: ActionNode ) {
    const frag = {
      in: this.automaton.newState(),
      out: this.automaton.newState()
    };
    frag.in.addTransition( new ActionTransition( node.value ), frag.out );
    return frag;
  }

  Named( node: Named ) {
    const fragItem = this.gen( node.item );

    let subTransition;
    for ( const [ transition ] of fragItem.in ) {
      subTransition = transition;
      break;
    }

    const frag = {
      in: this.automaton.newState(),
      out: this.automaton.newState()
    };
    frag.in.addTransition( new NamedTransition( node.name, node.multiple, subTransition as ( RangeTransition | RuleTransition ) ), frag.out );
    return frag;
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

  genLexer( nodeToId: Map<LexerTokens, number> ) {
    const frag = {
      in: this.automaton.newState(),
      out: this.automaton.newState()
    };

    for ( const [ node, id ] of nodeToId ) {
      if ( node.type === "LexerRule" && node.modifiers.fragment ) {
        continue;
      }
      const fragItem = this.gen( node );
      frag.in.addEpsilon( fragItem.in );
      fragItem.out.addTransition( new TokenFinalTransition( id ), frag.out );
    }

    return frag;
  }

}
