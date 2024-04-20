import { State } from "./state.ts";
import { AnyTransition } from "./transitions.ts";

export type Frag = {
  readonly start: State;
  readonly end: State;
};

export class Automaton {
  private uuid = 1;

  newFrag(): Frag {
    return {
      start: this.newState(),
      end: this.newState(),
    };
  }

  newState(): State {
    return new State(this.uuid++);
  }

  single(transition: AnyTransition): Frag {
    const frag = this.newFrag();
    frag.start.addTransition(transition, frag.end);
    return frag;
  }

  empty(): Frag {
    const frag = this.newFrag();
    frag.start.addEpsilon(frag.end);
    return frag;
  }

  seq(fragments: readonly Frag[]): Frag {
    let first: State | null = null;
    let last: State | null = first;
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

  choice(fragments: readonly Frag[]): Frag {
    const frag = this.newFrag();
    for (const fragment of fragments) {
      frag.start.addEpsilon(fragment.start);
      fragment.end.addEpsilon(frag.end);
    }
    return frag;
  }

  repeat(item: Frag): Frag {
    const frag = this.newFrag();
    frag.start.addEpsilon(item.start);
    item.end.addEpsilon(frag.end);

    // Optimized *: just adds epsilon-transitions from input to the output, and back
    frag.start.addEpsilon(frag.end);
    frag.end.addEpsilon(frag.start);
    return frag;
  }

  repeat1(item: Frag): Frag {
    const frag = this.newFrag();
    frag.start.addEpsilon(item.start);
    item.end.addEpsilon(frag.end);

    // Optimized +: just add epsilon-transition from the output to the input
    frag.end.addEpsilon(frag.start);
    return frag;
  }

  optional(item: Frag): Frag {
    const frag = this.newFrag();
    frag.start.addEpsilon(item.start);
    item.end.addEpsilon(frag.end);

    // Optimized ?: just add epsilon-transition from the input to the output
    frag.start.addEpsilon(frag.end);
    return frag;
  }
}
