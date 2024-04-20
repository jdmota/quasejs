import { State, DState } from "../automaton/state.ts";
import {
  AnyTransition,
  EpsilonTransition,
  CallTransition,
} from "../automaton/transitions.ts";
import {
  AbstractNfaToDfa,
  AbstractDfaMinimizer,
} from "./abstract-optimizer.ts";
import { FollowInfoDB } from "../grammar/follow-info.ts";

const EPSILON = new EpsilonTransition();

const IGNORE_EPSILON = false;

export class NfaToDfa extends AbstractNfaToDfa<State, DState, AnyTransition> {
  newDFAState(id: number): DState {
    return new DState(id);
  }

  addTransition(state: DState, transition: AnyTransition, dest: DState) {
    state.addTransition(transition, dest);
  }

  getEpsilonStates(state: State) {
    return IGNORE_EPSILON ? new Set<State>() : state.mapKeyToSet.get(EPSILON);
  }

  combinations(closure: State[]) {
    const combination = new State(0);
    for (const state of closure) {
      for (const [transition, set] of state.mapKeyToSet) {
        if (!IGNORE_EPSILON && transition instanceof EpsilonTransition) {
          continue;
        }
        combination.mapKeyToSet.add(transition, set);
      }
      combination.mapRangeToSet.importFrom(state.mapRangeToSet);
    }
    return combination[Symbol.iterator]();
  }
}

export class DfaMinimizer extends AbstractDfaMinimizer<DState, AnyTransition> {
  private readonly follows: FollowInfoDB;
  private currentProcessedRule: string;

  constructor(follows: FollowInfoDB) {
    super();
    this.follows = follows;
    this.currentProcessedRule = "";
  }

  setCurrentRule(name: string) {
    this.currentProcessedRule = name;
  }

  newDFAState(id: number): DState {
    return new DState(id);
  }

  addTransition(state: DState, transition: AnyTransition, dest: DState): void {
    state.addTransition(transition, dest);

    if (transition instanceof CallTransition) {
      this.follows.add(this.currentProcessedRule, state, transition, dest);
    }
  }

  getTransitions(
    state: DState
  ): IterableIterator<readonly [AnyTransition, DState]> {
    return state[Symbol.iterator]();
  }

  isDifferentRanges(p: DState, q: DState, pairsTable: boolean[][]): boolean {
    const itP = p.rangeList[Symbol.iterator]();
    const itQ = q.rangeList[Symbol.iterator]();
    let stepP = itP.next();
    let stepQ = itQ.next();

    // If t(p, a), t(q, a) is marked, mark p, q
    // If t(p, a) exists and t(q, a) does not, mark p, q

    while (!stepP.done && !stepQ.done) {
      let [rangeP, pA] = stepP.value;
      let [rangeQ, qA] = stepQ.value;
      if (rangeP.from === rangeQ.from) {
        if (pairsTable[pA.id][qA.id]) {
          return true;
        }
        if (rangeP.to < rangeQ.to) {
          stepP = itP.next();
          rangeQ = {
            from: rangeP.to + 1,
            to: rangeQ.to,
          };
        } else if (rangeP.to > rangeQ.to) {
          rangeP = {
            from: rangeQ.to + 1,
            to: rangeP.to,
          };
          stepQ = itQ.next();
        } else {
          stepP = itP.next();
          stepQ = itQ.next();
        }
      } else {
        // p (or q) has transitions that q (or p) does not
        return true;
      }
    }

    // p (or q) has transitions that q (or p) does not
    if (!stepP.done || !stepQ.done) {
      return true;
    }
    return false;
  }

  isDifferentTransitions(
    p: DState,
    q: DState,
    pairsTable: boolean[][]
  ): boolean {
    // If t(p, a), t(q, a) is marked, mark p, q
    // If t(p, a) exists and t(q, a) does not, mark p, q

    if (p.transitionsMap.size !== q.transitionsMap.size) {
      return true;
    }

    for (const [transition, pA] of p.transitionsMap) {
      const qA = q.transitionsMap.get(transition);
      if (qA) {
        if (pairsTable[pA.id][qA.id]) {
          return true;
        }
      } else {
        return true;
      }
    }

    return false;
  }

  isDifferent(p: DState, q: DState, pairsTable: boolean[][]): boolean {
    return (
      this.isDifferentTransitions(p, q, pairsTable) ||
      this.isDifferentRanges(p, q, pairsTable)
    );
  }
}
