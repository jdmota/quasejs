import { EPSILON } from "./utils";

const compareNumber = ( a, b ) => a - b;

export function nfaToDfa( { states: oldStates, alphabet, start, acceptingSet: prevAcceptingStates } ) {

  const closures = new Map();

  function getClosure( state ) {
    let closure = closures.get( state );
    if ( !closure ) {
      closure = new Set();
      closure.add( state );
      closures.set( state, closure );

      const destinationStates = oldStates[ state ].get( EPSILON );
      if ( destinationStates ) {
        for ( const nextState of destinationStates ) {
          if ( !closure.has( nextState ) ) {
            closure.add( nextState );
            for ( const s of getClosure( nextState ) ) {
              closure.add( s );
            }
          }
        }
      }
    }
    return closure;
  }

  const states = [ null ];
  const stateStringToId = new Map();
  const acceptingSet = new Set();

  function createState( closure ) {
    const closureStr = closure.join( "," );
    let id = stateStringToId.get( closureStr );
    if ( id == null ) {
      id = states.length;
      stateStringToId.set( closureStr, id );

      const newMap = new Map();
      states.push( newMap );

      for ( const state of closure ) {
        if ( prevAcceptingStates.has( state ) ) {
          acceptingSet.add( id );
        }
      }

      for ( const symbol of alphabet ) {

        const combinedStates = new Set();
        for ( const state of closure ) {
          const arr = oldStates[ state ].get( symbol );
          if ( arr ) arr.forEach( s => getClosure( s ).forEach( s => combinedStates.add( s ) ) );
        }

        if ( combinedStates.size > 0 ) {
          newMap.set( symbol, createState( Array.from( combinedStates ).sort( compareNumber ) ) );
        }
      }
    }
    return id;
  }

  createState( Array.from( getClosure( start ) ).sort( compareNumber ) );

  return {
    states,
    alphabet,
    acceptingSet
  };
}

function sameKeys( a, b ) {
  if ( a.size !== b.size ) {
    return false;
  }
  for ( const key of a.keys() ) {
    if ( !b.has( key ) ) {
      return false;
    }
  }
  return true;
}

export function minimize( { states, alphabet, acceptingSet } ) {

  const numberOfStates = states.length - 1;
  const pairsTable = new Array( numberOfStates + 1 );

  for ( let state = 1; state <= numberOfStates; state++ ) {
    pairsTable[ state ] = new Array( numberOfStates + 1 );
    pairsTable[ state ][ state ] = false;
  }

  let notMarked = [];
  let notMarked2 = [];

  // Mark all pairs p, q where p is final and q is not
  // Mark all pairs that p has a transition and q does not
  // Note: (1,1) belongs to the diagonal, so we can start with p=2
  for ( let p = 2; p <= numberOfStates; p++ ) {
    for ( let q = 1; q < p; q++ ) {
      const mark =
        acceptingSet.has( p ) !== acceptingSet.has( q ) ||
        !sameKeys( states[ p ], states[ q ] );
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

      // For all symbol a
      for ( const symbol of alphabet ) {
        const pA = states[ p ].get( symbol );
        const qA = states[ q ].get( symbol );
        // If pair t(p, a), t(q, a) is marked then
        if ( pA && qA ) {
          // Mark p, q
          if ( pairsTable[ pA ][ qA ] ) {
            pairsTable[ p ][ q ] = true;
            pairsTable[ q ][ p ] = true;
            break;
          }
        } else if ( pA || qA ) {
          pairsTable[ p ][ q ] = true;
          pairsTable[ q ][ p ] = true;
          break;
        }
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

  const minimizedTable = new Array( finalNumberOfStates + 1 );
  minimizedTable[ 0 ] = null;
  const minimizedAcceptingStates = new Set();

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
      minimizedTable[ id ] = {};
      for ( const [ symbol, to ] of states[ oldState ] ) {

        let rep = to;
        while ( unions[ rep ] > 0 ) rep = unions[ rep ];
        unions[ to ] = unions[ rep ];

        minimizedTable[ id ][ symbol ] = -unions[ rep ];
      }
    }
  }

  return {
    table: minimizedTable,
    acceptingStates: minimizedAcceptingStates
  };
}
