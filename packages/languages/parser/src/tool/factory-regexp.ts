import { parse as parseRegexp } from "regexp-tree";
import {
  AstRegExp, Char, CharacterClass,
  Alternative, Group, Backreference,
  Repetition, Expression, Assertion
} from "regexp-tree/ast"; // eslint-disable-line import/no-unresolved
import { RegexpNode } from "./parser/grammar-parser";
import { Frag, Automaton } from "./automaton";

type Char2 = Char & { codePoint: number };

export class FactoryRegexp {

  automaton: Automaton;

  constructor( automaton: Automaton ) {
    this.automaton = automaton;
  }

  Char( { codePoint, kind }: Char2 ) {
    if ( codePoint == null || Number.isNaN( codePoint ) ) {
      throw new Error( `Char of kind ${kind} is not supported` );
    }
    const _in = this.automaton.newState();
    const _out = this.automaton.newState();
    _in.addNumber( codePoint, _out );
    return { in: _in, out: _out };
  }

  CharacterClass( { negative, expressions }: CharacterClass ) {
    if ( negative ) {
      throw new Error( `Negative CharacterClass is not supported` );
    }
    const fragments = ( expressions || [] ).map( e => this.gen( e ) );
    // @ts-ignore
    return this.automaton.or( ...fragments );
  }

  ClassRange( { from, to }: { from: Char2; to: Char2 } ) {
    const _in = this.automaton.newState();
    const _out = this.automaton.newState();
    _in.addRange( from.codePoint, to.codePoint, _out );
    return { in: _in, out: _out };
  }

  Alternative( { expressions }: Alternative ) {
    const fragments = ( expressions || [] ).map( e => this.gen( e ) );
    // @ts-ignore
    return this.automaton.alteration( ...fragments );
  }

  Disjunction( { left, right }: { left: Expression; right: Expression } ) {
    return this.automaton.or( this.gen( left ), this.gen( right ) );
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
        return this.automaton.rep( this.gen( expression ) );
      case "+":
        return this.automaton.plusRep( this.gen( expression ) );
      case "?":
        return this.automaton.question( this.gen( expression ) );
      case "Range":
        if ( quantifier.from === 0 && quantifier.to == null ) {
          return this.automaton.rep( this.gen( expression ) );
        }
        if ( quantifier.from === 1 && quantifier.to == null ) {
          return this.automaton.plusRep( this.gen( expression ) );
        }
        if ( quantifier.from === 0 && quantifier.to === 1 ) {
          return this.automaton.question( this.gen( expression ) );
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

export function regexpToAutomaton( factory: FactoryRegexp, node: RegexpNode ) {
  return factory.gen( parseRegexp( node.raw ) );
}
