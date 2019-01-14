import { NFAState } from "./automaton-state";

export class Automaton {

  states: NFAState[];
  acceptingSet: Set<number>;

  constructor() {
    this.states = [ new NFAState() ];
    this.acceptingSet = new Set();
  }

  newState() {
    const id = this.states.length;
    const state = new NFAState();
    this.states.push( state );
    return id;
  }

  addEpsilon( a: number, b: number ) {
    this.states[ a ].addEpsilon( b );
  }

  addNumber( a: number, symbol: number, b: number ) {
    this.states[ a ].addNumber( symbol, b );
  }

  addRange( a: number, range: { from: number; to: number }, b: number ) {
    this.states[ a ].addRange( range, b );
  }

}
