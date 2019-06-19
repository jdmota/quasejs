import { DState } from "./state";
import {
  Transition, RuleTransition, PredicateTransition,
  RangeTransition, EOFTransition, NamedTransition, TokenFinalTransition
} from "./transitions";
import { MapKeyToSet } from "./utils/map-key-to-set";
import { MapKeyToValue } from "./utils/map-key-to-value";
import { MapRangeToValue } from "./utils/map-range-to-value";
import { MapRangeToSet } from "./utils/map-range-to-set";
import { Rule, ParserRule, LexerRule } from "./parser/grammar-parser";

export class Context {

  parent: Context | null;
  size: number;

  constructor( parent: Context | null ) {
    this.parent = parent;
    this.size = parent ? parent.size + 1 : 0;
  }

}

export type Look = RangeTransition | PredicateTransition | EOFTransition;
export type GoTo = [ Transition, DState ] | null;

class LookSet {

  transitions: MapKeyToValue<PredicateTransition | EOFTransition, null>;
  ranges: MapRangeToValue<null>;

  constructor() {
    this.transitions = new MapKeyToValue();
    this.ranges = new MapRangeToValue();
  }

  add( transition: Look ) {
    if ( transition instanceof RangeTransition ) {
      this.ranges.addRange( transition.from, transition.to, null );
    } else {
      this.transitions.add( transition, null );
    }
  }

  importFrom( other: LookSet ) {
    for ( const [ transition, value ] of other.transitions ) {
      this.transitions.add( transition, value );
    }
    for ( const [ range, value ] of other.ranges ) {
      this.ranges.addRange( range.from, range.to, value );
    }
  }

  * [Symbol.iterator](): IterableIterator<Look> {
    for ( const [ transition ] of this.transitions ) {
      yield transition;
    }
    for ( const [ range ] of this.ranges ) {
      yield new RangeTransition( range.from, range.to );
    }
  }

}

class LookData {

  transitions: MapKeyToSet<PredicateTransition | EOFTransition, GoTo>;
  ranges: MapRangeToSet<GoTo>;

  constructor() {
    this.transitions = new MapKeyToSet();
    this.ranges = new MapRangeToSet();
  }

  add( transition: Look, value: GoTo ) {
    if ( transition instanceof RangeTransition ) {
      this.ranges.addRange( transition.from, transition.to, new Set( [ value ] ) );
    } else {
      this.transitions.addOne( transition, value );
    }
  }

  * [Symbol.iterator](): IterableIterator<[Look, Set<GoTo>]> {
    for ( const entry of this.transitions ) {
      yield entry;
    }
    for ( const [ range, value ] of this.ranges ) {
      yield [ new RangeTransition( range.from, range.to ), value ];
    }
  }

}

function sortConflicts( a: GoTo, b: GoTo ) {
  if ( a != null && a[ 0 ] instanceof TokenFinalTransition ) {
    if ( b != null && b[ 0 ] instanceof TokenFinalTransition ) {
      return a[ 0 ].id - b[ 0 ].id;
    }
    return 1;
  }
  return -1;
}

export class Analyser {

  initialStates: Map<Rule, DState>;
  finalStates: Map<DState, Rule | null>;
  follows: Map<Rule, Set<DState>>;
  lookahead: Map<DState, LookSet>;
  conflicts: string[];

  constructor( { initialStates, finalStates, follows }: {
    initialStates: Map<Rule, DState>;
    finalStates: Map<DState, Rule | null>;
    follows: Map<Rule, Set<DState>>;
  } ) {
    this.initialStates = initialStates;
    this.finalStates = finalStates;
    this.follows = follows;
    this.lookahead = new Map();
    this.conflicts = [];
  }

  lookaheadForState( state: DState ) {
    let set = this.lookahead.get( state );
    let existed = true;
    if ( !set ) {
      set = new LookSet();
      existed = false;
      this.lookahead.set( state, set );
    }
    return {
      set,
      existed
    };
  }

  testConflict( rule: ParserRule | LexerRule | null, state: DState, look: Look, set: Set<GoTo> ) {
    const arr = Array.from( set ).sort( sortConflicts );
    if ( arr.length > 1 ) {
      this.conflicts.push(
        `In ${rule ? `rule ${rule.name}` : "lexer"}, in state ${state.id}, when seeing ${look}, multiple choices: ` +
        `${arr.map( goto => ( goto ? `${goto[ 0 ]} to ${goto[ 1 ].id}` : "leave" ) ).join( "; " )}`
      );
    } else if ( arr.length === 0 ) {
      throw new Error( "Assertion error" );
    }
    return arr[ 0 ];
  }

  _analyseFinalState( state: DState, ctx: Context | null, set: LookSet ) {
    let ret = false;
    if ( ctx ) {
      if ( ctx.size === 0 ) {
        // EOF
        set.add( new EOFTransition() );
      }
      ret = true;
      return ret;
    }
    // Follow
    const rule = this.finalStates.get( state );
    const f = rule && this.follows.get( rule );
    if ( f && f.size > 0 ) {
      for ( const dest of f ) {
        const result = this._analyse( dest, ctx );
        set.importFrom( result.set );
        ret = result.ret || ret;
      }
      if ( rule && rule.modifiers.start ) {
        // EOF
        set.add( new EOFTransition() );
      }
    } else {
      // EOF
      set.add( new EOFTransition() );
    }
    return ret;
  }

  _analyse( state: DState, ctx: Context | null ): { set: LookSet; ret: boolean } {
    const { set, existed } = this.lookaheadForState( state );
    if ( existed ) {
      return {
        set,
        ret: false
      };
    }

    let ret = false;

    if ( this.finalStates.has( state ) ) {
      ret = this._analyseFinalState( state, ctx, set );
    }

    for ( const [ transition, dest ] of state ) {
      ret = this._analyseTransition( transition, dest, ctx, set ) || ret;
    }

    return {
      set,
      ret
    };
  }

  _analyseTransition(
    transition: Transition, dest: DState, ctx: Context | null, set: LookSet
  ): boolean {
    if ( transition instanceof RuleTransition ) {
      const newCtx = ctx ? new Context( ctx ) : null;

      const result = this._analyse( this.initialStates.get( transition.rule ) as DState, newCtx );
      set.importFrom( result.set );

      if ( result.ret ) {
        const result2 = this._analyse( dest, ctx );
        set.importFrom( result2.set );
        return result2.ret;
      }
      return false;
    }
    if ( transition instanceof PredicateTransition ) {
      set.add( transition );
      return false;
    }
    if ( transition instanceof RangeTransition ) {
      set.add( transition );
      return false;
    }
    if ( transition instanceof NamedTransition ) {
      return this._analyseTransition( transition.subTransition, dest, ctx, set );
    }
    if ( transition.isEpsilon ) {
      const result = this._analyse( dest, ctx );
      set.importFrom( result.set );
      return result.ret;
    }
    throw new Error( "Assertion error" );
  }

  analyse( state: DState, ctx: Context | null ) {

    const lookData: LookData = new LookData(); // look<A, B> -> if we see A, go to B

    if ( this.finalStates.has( state ) ) {
      const set: LookSet = new LookSet();
      this._analyseFinalState( state, ctx, set );
      for ( const look of set ) {
        lookData.add( look, null );
      }
    }

    for ( const [ transition, dest ] of state ) {
      const set: LookSet = new LookSet();
      this._analyseTransition( transition, dest, ctx, set );
      for ( const look of set ) {
        lookData.add( look, [ transition, dest ] );
      }
    }

    return lookData;
  }

}
