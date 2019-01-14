import { NFAState, DFAState } from "../utils/automaton-state";

const compareNumber = ( a: number, b: number ) => a - b;

type NFA = {
  states: NFAState[];
  start: number;
  acceptingSet: Set<number>;
};

type DFA = {
  states: DFAState[];
  acceptingSet: Set<number>;
};

export function nfaToDfa( { states: oldStates, start, acceptingSet: prevAcceptingStates }: NFA ) {

  const closures = new Map();

  function getClosure( state: number ): Set<number> {
    let closure = closures.get( state );
    if ( !closure ) {
      closure = new Set( [ state ] );
      closures.set( state, closure );

      const destinationStates = oldStates[ state ].epsilonStates;
      for ( const nextState of destinationStates ) {
        if ( !closure.has( nextState ) ) {
          closure.add( nextState );
          for ( const s of getClosure( nextState ) ) {
            closure.add( s );
          }
        }
      }
    }
    return closure;
  }

  const states: DFAState[] = [ new DFAState() ];
  const stateStringToId = new Map();
  const acceptingSet: Set<number> = new Set();

  function createState( closure: number[] ): number {
    const closureStr = closure.join( "," );
    let id = stateStringToId.get( closureStr );
    if ( id == null ) {
      id = states.length;
      stateStringToId.set( closureStr, id );

      const newState = new DFAState();
      states.push( newState );

      const combinedStates = new NFAState();

      for ( const state of closure ) {
        if ( prevAcceptingStates.has( state ) ) {
          acceptingSet.add( id );
        }
        combinedStates.importFrom( oldStates[ state ] );
      }

      for ( const [ transition, set ] of combinedStates ) {
        const closure = new Set();
        for ( const s of set ) {
          for ( const s2 of getClosure( s ) ) {
            closure.add( s2 );
          }
        }
        const dest = createState( Array.from( closure ).sort( compareNumber ) );
        newState.addRange( transition, dest );
      }
    }
    return id;
  }

  createState( Array.from( getClosure( start ) ).sort( compareNumber ) );

  return {
    states,
    acceptingSet
  };
}

export function minimize( { states, acceptingSet }: DFA ): DFA {

  const numberOfStates = states.length - 1;
  const pairsTable: boolean[][] = new Array( numberOfStates + 1 );

  for ( let state = 1; state <= numberOfStates; state++ ) {
    pairsTable[ state ] = new Array( numberOfStates + 1 );
    pairsTable[ state ][ state ] = false;
  }

  let notMarked: [ number, number ][] = [];
  let notMarked2: [ number, number ][] = [];

  // Mark all pairs p, q where p is final and q is not
  // Note: (1,1) belongs to the diagonal, so we can start with p=2
  for ( let p = 2; p <= numberOfStates; p++ ) {
    for ( let q = 1; q < p; q++ ) {
      const mark = acceptingSet.has( p ) !== acceptingSet.has( q );
      pairsTable[ p ][ q ] = mark;
      pairsTable[ q ][ p ] = mark;
      if ( !mark ) {
        notMarked.push( [ p, q ] );
      }
    }
  }

  while ( true ) {
    let marked = false;

    // For all non-marked pairs p, q
    for ( const pair of notMarked ) {
      const [ p, q ] = pair;
      const itP = states[ p ][ Symbol.iterator ]();
      const itQ = states[ q ][ Symbol.iterator ]();
      let stepP = itP.next();
      let stepQ = itQ.next();

      // If t(p, a), t(q, a) is marked, mark p, q
      // If t(p, a) exists and t(q, a) does not, mark p, q

      while ( !stepP.done && !stepQ.done ) {
        let [ rangeP, pA ] = stepP.value;
        let [ rangeQ, qA ] = stepQ.value;
        if ( rangeP.from === rangeQ.from ) {
          if ( pairsTable[ pA ][ qA ] ) {
            pairsTable[ p ][ q ] = true;
            pairsTable[ q ][ p ] = true;
            break;
          }
          if ( rangeP.to < rangeQ.to ) {
            stepP = itP.next();
            rangeQ = {
              from: rangeP.to + 1,
              to: rangeQ.to
            };
          } else if ( rangeP.to > rangeQ.to ) {
            rangeP = {
              from: rangeQ.to + 1,
              to: rangeP.to
            };
            stepQ = itQ.next();
          } else {
            stepP = itP.next();
            stepQ = itQ.next();
          }
        } else {
          // p (or q) has transitions that q (or p) does not
          pairsTable[ p ][ q ] = true;
          pairsTable[ q ][ p ] = true;
          break;
        }
      }

      // p (or q) has transitions that q (or p) does not
      if ( !stepP.done || !stepQ.done ) {
        pairsTable[ p ][ q ] = true;
        pairsTable[ q ][ p ] = true;
      }

      if ( pairsTable[ p ][ q ] ) {
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

  const minimizedStates: DFAState[] = [ new DFAState() ];
  const minimizedAcceptingStates: Set<number> = new Set();

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
  for ( const final of acceptingSet ) {
    if ( unions[ final ] === 0 ) {
      minimizedAcceptingStates.add( finalUUID );
      unions[ final ] = -finalUUID;
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

  for ( let oldState = 1; oldState < unions.length; oldState++ ) {
    if ( unions[ oldState ] < 0 ) {
      const id = -unions[ oldState ];
      minimizedStates[ id ] = new DFAState();
      for ( const [ range, to ] of states[ oldState ] ) {

        let rep = to;
        while ( unions[ rep ] > 0 ) rep = unions[ rep ];
        unions[ to ] = unions[ rep ];

        minimizedStates[ id ].addRange( range, -unions[ rep ] );
      }
    }
  }

  return {
    states: minimizedStates,
    acceptingSet: minimizedAcceptingStates
  };
}
