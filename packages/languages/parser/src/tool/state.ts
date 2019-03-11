import { Transition, EpsilonTransition, RangeTransition } from "./transitions";
import { MapKeyToSet } from "./utils/map-key-to-set";
import { MapRangeToSet } from "./utils/map-range-to-set";
import { MapKeyToValue } from "./utils/map-key-to-value";
import { MapRangeToValue } from "./utils/map-range-to-value";

const EPSILON = new EpsilonTransition();

export class State {

  id: number;
  mapKeyToSet: MapKeyToSet<Transition, State>;
  mapRangeToSet: MapRangeToSet<State>;

  constructor( id: number ) {
    this.id = id;
    this.mapKeyToSet = new MapKeyToSet();
    this.mapRangeToSet = new MapRangeToSet();
  }

  addTransition( transition: Transition, dest: State ) {
    this.mapKeyToSet.add( transition, new Set( [ dest ] ) );
  }

  addEpsilon( dest: State ) {
    this.mapKeyToSet.add( EPSILON, new Set( [ dest ] ) );
  }

  // Char code point or Token id
  addNumber( number: number, dest: State ) {
    this.mapRangeToSet.addRange( number, number, new Set( [ dest ] ) );
  }

  addRange( from: number, to: number, dest: State ) {
    this.mapRangeToSet.addRange( from, to, new Set( [ dest ] ) );
  }

  addNotRangeSet( set: [number, number][], dest: State, min: number, max: number ) {
    this.mapRangeToSet.addNotRangeSet( set, new Set( [ dest ] ), min, max );
  }

  addWildcard( dest: State, min: number, max: number ) {
    this.mapRangeToSet.addRange( min, max, new Set( [ dest ] ) );
  }

  * [Symbol.iterator](): It {
    for ( const step of this.mapKeyToSet ) {
      yield step;
    }
    for ( const [ range, set ] of this.mapRangeToSet ) {
      yield [ new RangeTransition( range.from, range.to ), set ];
    }
  }

}

// Hack to avoid babel bug
type It = IterableIterator<[Transition, Set<State>]>;
type It2 = IterableIterator<[Transition, DState]>;

export class DState {

  id: number;
  transitionsMap: MapKeyToValue<Transition, DState>;
  rangeList: MapRangeToValue<DState>;
  inTransitions: number;

  constructor( id: number ) {
    this.id = id;
    this.transitionsMap = new MapKeyToValue();
    this.rangeList = new MapRangeToValue();
    this.inTransitions = 0;
  }

  addTransition( transition: Transition, dest: DState ) {
    let added = false;
    if ( transition instanceof RangeTransition ) {
      added = this.rangeList.addRange( transition.from, transition.to, dest );
    } else {
      added = this.transitionsMap.add( transition, dest );
    }
    if ( added ) {
      dest.inTransitions++;
    }
  }

  transitionAmount() {
    return this.transitionsMap.size + this.rangeList.size;
  }

  * [Symbol.iterator](): It2 {
    for ( const value of this.transitionsMap ) {
      yield value;
    }
    for ( const [ range, value ] of this.rangeList ) {
      yield [ new RangeTransition( range.from, range.to ), value ];
    }
  }

}
