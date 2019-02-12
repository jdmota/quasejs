type NFA<NFAState> = {
  start: NFAState;
  acceptingSet: Set<NFAState>;
};

export type DFA<DFAState> = {
  states: DFAState[];
  start: DFAState;
  acceptingSet: Set<DFAState>;
};

type BaseState = {
  id: number;
};

const compareState = ( a: BaseState, b: BaseState ) => a.id - b.id;

export abstract class AbstractNfaToDfa<NFAState extends BaseState, DFAState extends BaseState, Transition> {

  closures: Map<NFAState, Set<NFAState>>;
  oldAcceptingSet: Set<NFAState>;
  states: DFAState[];
  closuseStrToState: Map<string, DFAState>;
  acceptingSet: Set<DFAState>;

  constructor() {
    this.closures = new Map();
    this.oldAcceptingSet = new Set();
    this.states = [];
    this.closuseStrToState = new Map();
    this.acceptingSet = new Set();
  }

  abstract newDFAState( id: number ): DFAState;

  abstract addTransition( state: DFAState, transition: Transition, dest: DFAState ): void;

  abstract getEpsilonStates( state: NFAState ): NFAState[] | Set<NFAState>;

  abstract combinations( closure: NFAState[] ): IterableIterator<[ Transition, Set<NFAState> ]>;

  getEpsilonClosure( state: NFAState ): Set<NFAState> {
    let closure = this.closures.get( state );
    if ( !closure ) {
      closure = new Set( [ state ] );
      this.closures.set( state, closure );

      for ( const nextState of this.getEpsilonStates( state ) ) {
        if ( !closure.has( nextState ) ) {
          closure.add( nextState );
          for ( const s of this.getEpsilonClosure( nextState ) ) {
            closure.add( s );
          }
        }
      }
    }
    return closure;
  }

  createState( closure: NFAState[] ): DFAState {
    const closureStr = closure.map( ( { id } ) => id ).join( "," );
    let newState = this.closuseStrToState.get( closureStr );
    if ( newState == null ) {
      newState = this.newDFAState( this.states.length );
      this.states.push( newState );
      this.closuseStrToState.set( closureStr, newState );

      for ( const state of closure ) {
        if ( this.oldAcceptingSet.has( state ) ) {
          this.acceptingSet.add( newState );
          break;
        }
      }

      for ( const [ transition, set ] of this.combinations( closure ) ) {
        const closure = new Set();
        for ( const s of set ) {
          for ( const s2 of this.getEpsilonClosure( s ) ) {
            closure.add( s2 );
          }
        }
        const dest = this.createState( Array.from( closure ).sort( compareState ) );
        this.addTransition( newState, transition, dest );
      }
    }
    return newState;
  }

  do( { start: oldStart, acceptingSet: oldAcceptingSet }: NFA<NFAState> ): DFA<DFAState> {
    this.closures = new Map();
    this.oldAcceptingSet = oldAcceptingSet;
    this.states = [ this.newDFAState( 0 ) ];
    this.closuseStrToState = new Map();
    this.acceptingSet = new Set();

    const start = this.createState( Array.from( this.getEpsilonClosure( oldStart ) ).sort( compareState ) );

    return {
      states: this.states,
      start,
      acceptingSet: this.acceptingSet
    };
  }

}

export abstract class AbstractDfaMinimizer<DFAState extends BaseState, Transition> {

  abstract newDFAState( id: number ): DFAState;

  abstract addTransition( state: DFAState, transition: Transition, dest: DFAState ): void;

  abstract getTransitions( state: DFAState ): IterableIterator<[ Transition, DFAState ]>;

  abstract isDifferent( p: DFAState, q: DFAState, pairsTable: boolean[][] ): boolean;

  minimize( { states: oldStates, acceptingSet: oldAcceptingSet }: DFA<DFAState> ): DFA<DFAState> {

    const numberOfStates = oldStates.length - 1;
    const pairsTable: boolean[][] = new Array( numberOfStates + 1 );

    for ( let id = 1; id <= numberOfStates; id++ ) {
      pairsTable[ id ] = new Array( numberOfStates + 1 );
      pairsTable[ id ][ id ] = false;
    }

    let notMarked: [ DFAState, DFAState ][] = [];
    let notMarked2: [ DFAState, DFAState ][] = [];

    // Mark all pairs p, q where p is final and q is not
    // Note: (1,1) belongs to the diagonal, so we can start with p=2
    for ( let pId = 2; pId <= numberOfStates; pId++ ) {
      for ( let qId = 1; qId < pId; qId++ ) {
        const pair: [ DFAState, DFAState ] = [ oldStates[ pId ], oldStates[ qId ] ];
        const [ p, q ] = pair;
        const mark = oldAcceptingSet.has( p ) !== oldAcceptingSet.has( q );
        pairsTable[ pId ][ qId ] = mark;
        pairsTable[ qId ][ pId ] = mark;
        if ( !mark ) {
          notMarked.push( pair );
        }
      }
    }

    while ( true ) {
      let marked = false;

      // For all non-marked pairs p, q
      for ( const pair of notMarked ) {
        const [ p, q ] = pair;

        if ( this.isDifferent( p, q, pairsTable ) ) {
          pairsTable[ p.id ][ q.id ] = true;
          pairsTable[ q.id ][ p.id ] = true;
          marked = true;
        } else {
          notMarked2.push( pair );
        }
      }

      if ( marked ) {
        notMarked = notMarked2;
        notMarked2 = [];
      } else {
        break;
      }
    }

    const minimizedStates: DFAState[] = [];
    const minimizedAcceptingStates: Set<DFAState> = new Set();

    // [ ignore, 0, 0, 0, 0, ... ]
    const unions = new Array( numberOfStates + 1 );
    for ( let i = 0; i < unions.length; i++ ) {
      unions[ i ] = 0;
    }

    let finalNumberOfStates = numberOfStates;

    // Note: (1,1) belongs to the diagonal, so we can start with p=2
    for ( let p = 2; p <= numberOfStates; p++ ) {
      for ( let q = 1; q < p; q++ ) {
        const equivalent = pairsTable[ p ][ q ] === false;
        if ( equivalent ) {
          // Find representatives of p and q and make union
          let p2 = p, q2 = q;
          while ( unions[ p2 ] ) p2 = unions[ p2 ];
          while ( unions[ q2 ] ) q2 = unions[ q2 ];
          if ( p2 !== q2 ) {
            unions[ p2 ] = q2;
            finalNumberOfStates--;
          }
        }
      }
    }

    for ( let id = 0; id <= finalNumberOfStates; id++ ) {
      minimizedStates[ id ] = this.newDFAState( id );
    }

    // In the next 3 steps, give -uuid to the representatives of each union

    // Make 1 be the representative of its union and give it -1
    {
      let rep = 1;
      while ( unions[ rep ] ) rep = unions[ rep ];
      unions[ rep ] = 1;
      unions[ 1 ] = -1;
    }

    // Final states should have the last numbers
    let finalUUID = finalNumberOfStates;
    for ( const final of oldAcceptingSet ) {
      if ( unions[ final.id ] === 0 ) {
        unions[ final.id ] = -finalUUID;
        finalUUID--;
      }
    }

    // Give -uuid to the rest
    let uuid = 2;
    for ( let oldState = 1; oldState < unions.length; oldState++ ) {
      if ( unions[ oldState ] === 0 ) {
        unions[ oldState ] = -uuid;
        uuid++;
      }
    }

    for ( let oldStateId = 1; oldStateId < unions.length; oldStateId++ ) {
      if ( unions[ oldStateId ] < 0 ) {
        const id = -unions[ oldStateId ];
        const state = minimizedStates[ id ];
        const oldState = oldStates[ oldStateId ];

        if ( oldAcceptingSet.has( oldState ) ) {
          minimizedAcceptingStates.add( state );
        }

        for ( const [ transition, to ] of this.getTransitions( oldState ) ) {
          let rep = to.id;
          while ( unions[ rep ] > 0 ) rep = unions[ rep ];
          unions[ to.id ] = unions[ rep ];
          this.addTransition( state, transition, minimizedStates[ -unions[ rep ] ] );
        }
      }
    }

    return {
      states: minimizedStates,
      start: minimizedStates[ 1 ],
      acceptingSet: minimizedAcceptingStates
    };
  }

}
