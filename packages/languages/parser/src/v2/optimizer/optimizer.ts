import { State, DState } from "../automaton/state";
import { AnyTransition, EpsilonTransition } from "../automaton/transitions";
import type { AnyRule } from "../grammar/grammar-builder";
import { AbstractNfaToDfa, AbstractDfaMinimizer } from "./abstract-optimizer";

const EPSILON = new EpsilonTransition();

export class NfaToDfa extends AbstractNfaToDfa<State, DState, AnyTransition> {
  newDFAState(id: number): DState {
    return new DState(id);
  }

  addTransition(state: DState, transition: AnyTransition, dest: DState) {
    state.addTransition(transition, dest);
  }

  getEpsilonStates(state: State) {
    return state.mapKeyToSet.get(EPSILON);
  }

  combinations(closure: State[]) {
    const combination = new State(0);
    for (const state of closure) {
      for (const [transition, set] of state.mapKeyToSet) {
        if (transition instanceof EpsilonTransition) {
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
  readonly follows: Map<AnyRule, Set<DState>>;

  constructor() {
    super();
    this.follows = new Map();
  }

  _addFollow(rule: AnyRule, dest: DState) {
    const set = this.follows.get(rule);
    if (set) {
      set.add(dest);
    } else {
      this.follows.set(rule, new Set([dest]));
    }
  }

  newDFAState(id: number): DState {
    return new DState(id);
  }

  addTransition(state: DState, transition: AnyTransition, dest: DState): void {
    state.addTransition(transition, dest);
    // throw new Error("TODO");
    /*if (transition instanceof RuleTransition) {
      this._addFollow(transition.rule, dest);
    } else if (
      transition instanceof NamedTransition &&
      transition.subTransition instanceof RuleTransition
    ) {
      this._addFollow(transition.subTransition.rule, dest);
    }*/
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
