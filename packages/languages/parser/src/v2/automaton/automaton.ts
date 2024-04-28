import { AbstractNFAState, State } from "./state.ts";
import { AnyTransition } from "./transitions.ts";

export type Frag<S extends AbstractNFAState<S, T>, T> = {
  readonly start: S;
  readonly end: S;
};

export abstract class AbstractAutomaton<S extends AbstractNFAState<S, T>, T> {
  newFrag(): Frag<S, T> {
    return {
      start: this.newState(),
      end: this.newState(),
    };
  }

  abstract newState(): S;

  single(transition: T): Frag<S, T> {
    const frag = this.newFrag();
    frag.start.addTransition(transition, frag.end);
    return frag;
  }

  empty(): Frag<S, T> {
    const frag = this.newFrag();
    frag.start.addEpsilon(frag.end);
    return frag;
  }

  seq(fragments: readonly Frag<S, T>[]): Frag<S, T> {
    let first: S | null = null;
    let last: S | null = first;
    for (const fragment of fragments) {
      if (last) {
        last.addEpsilon(fragment.start);
      } else {
        first = fragment.start;
      }
      last = fragment.end;
    }
    first = first || this.newState();
    return {
      start: first,
      end: last || first,
    };
  }

  choice(fragments: readonly Frag<S, T>[]): Frag<S, T> {
    const frag = this.newFrag();
    for (const fragment of fragments) {
      frag.start.addEpsilon(fragment.start);
      fragment.end.addEpsilon(frag.end);
    }
    return frag;
  }

  repeat(item: Frag<S, T>): Frag<S, T> {
    const frag = this.newFrag();
    frag.start.addEpsilon(item.start);
    item.end.addEpsilon(frag.end);

    // Optimized *: just adds epsilon-transitions from input to the output, and back
    frag.start.addEpsilon(frag.end);
    frag.end.addEpsilon(frag.start);
    return frag;
  }

  repeat1(item: Frag<S, T>): Frag<S, T> {
    const frag = this.newFrag();
    frag.start.addEpsilon(item.start);
    item.end.addEpsilon(frag.end);

    // Optimized +: just add epsilon-transition from the output to the input
    frag.end.addEpsilon(frag.start);
    return frag;
  }

  optional(item: Frag<S, T>): Frag<S, T> {
    const frag = this.newFrag();
    frag.start.addEpsilon(item.start);
    item.end.addEpsilon(frag.end);

    // Optimized ?: just add epsilon-transition from the input to the output
    frag.start.addEpsilon(frag.end);
    return frag;
  }
}

export class Automaton extends AbstractAutomaton<State, AnyTransition> {
  private uuid = 1;

  newState(): State {
    return new State(this.uuid++);
  }
}
