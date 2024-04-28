import {
  AnyTransition,
  EpsilonTransition,
  RangeTransition,
} from "./transitions.ts";
import { MapKeyToSet } from "../utils/map-key-to-set.ts";
import { MapRangeToSet } from "../utils/map-range-to-set.ts";
import { MapKeyToValue } from "../utils/map-key-to-value.ts";
import { MapRangeToValue } from "../utils/map-range-to-value.ts";

export const EPSILON = new EpsilonTransition();

export abstract class AbstractNFAState<S extends AbstractNFAState<S, T>, T> {
  abstract readonly id: number;
  abstract addTransition(transition: T, dest: S): void;
  abstract addEpsilon(dest: S): void;
}

export abstract class AbstractDFAState<S extends AbstractDFAState<S, T>, T> {
  abstract readonly id: number;
  abstract addTransition(transition: T, dest: S): void;
  abstract transitionAmount(): number;
  abstract [Symbol.iterator](): IterableIterator<readonly [T, S]>;
}

export class State extends AbstractNFAState<State, AnyTransition> {
  readonly id: number;
  readonly mapKeyToSet: MapKeyToSet<AnyTransition, State>;
  readonly mapRangeToSet: MapRangeToSet<State>;

  constructor(id: number) {
    super();
    this.id = id;
    this.mapKeyToSet = new MapKeyToSet();
    this.mapRangeToSet = new MapRangeToSet();
  }

  addTransition(transition: AnyTransition, dest: State) {
    this.mapKeyToSet.add(transition, new Set([dest]));
    return dest;
  }

  addEpsilon(dest: State) {
    this.mapKeyToSet.add(EPSILON, new Set([dest]));
    return dest;
  }

  addNumber(number: number, dest: State) {
    this.mapRangeToSet.addRange(number, number, new Set([dest]));
    return dest;
  }

  addRange(from: number, to: number, dest: State) {
    this.mapRangeToSet.addRange(from, to, new Set([dest]));
    return dest;
  }

  addNotRangeSet(
    set: (readonly [number, number])[],
    dest: State,
    min: number,
    max: number
  ) {
    this.mapRangeToSet.addNotRangeSet(set, new Set([dest]), min, max);
    return dest;
  }

  addWildcard(dest: State, min: number, max: number) {
    this.mapRangeToSet.addRange(min, max, new Set([dest]));
    return dest;
  }

  *[Symbol.iterator](): IterableIterator<
    readonly [AnyTransition, ReadonlySet<State>]
  > {
    for (const step of this.mapKeyToSet) {
      yield step;
    }
    for (const [range, set] of this.mapRangeToSet) {
      yield [new RangeTransition(range.from, range.to, null), set] as const;
    }
  }
}

// Deterministic state
export class DState extends AbstractDFAState<DState, AnyTransition> {
  readonly id: number;
  readonly transitionsMap: MapKeyToValue<AnyTransition, DState>;
  readonly rangeList: MapRangeToValue<DState>;
  inTransitions: number;

  constructor(id: number) {
    super();
    this.id = id;
    this.transitionsMap = new MapKeyToValue();
    this.rangeList = new MapRangeToValue();
    this.inTransitions = 0;
  }

  override toString() {
    return `DState{${this.id}}`;
  }

  addTransition(transition: AnyTransition, dest: DState) {
    let added = false;
    if (transition instanceof RangeTransition && transition.field === null) {
      added = this.rangeList.addRange(transition.from, transition.to, dest);
    } else {
      added = this.transitionsMap.add(transition, dest);
    }
    if (added) {
      dest.inTransitions++;
    }
  }

  transitionAmount() {
    return this.transitionsMap.size + this.rangeList.size;
  }

  *destinations(): IterableIterator<DState> {
    for (const [_, dest] of this.transitionsMap) {
      yield dest;
    }
    for (const [_, dest] of this.rangeList) {
      yield dest;
    }
  }

  *[Symbol.iterator](): IterableIterator<readonly [AnyTransition, DState]> {
    for (const pair of this.transitionsMap) {
      yield pair;
    }
    for (const [range, dest] of this.rangeList) {
      yield [new RangeTransition(range.from, range.to, null), dest] as const;
    }
  }
}
