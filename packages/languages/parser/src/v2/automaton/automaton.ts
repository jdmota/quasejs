import { State } from "./state";

export type Frag = {
  readonly in: State;
  readonly out: State;
};

export class Automaton {
  readonly states: State[];

  constructor() {
    this.states = [new State(0)]; // So that state ids start at 1
  }

  newState(): State {
    const id = this.states.length;
    const state = new State(id);
    this.states.push(state);
    return state;
  }

  empty(): Frag {
    const frag = {
      in: this.newState(),
      out: this.newState(),
    };
    frag.in.addEpsilon(frag.out);
    return frag;
  }

  seq(fragments: Frag[]): Frag {
    let first: State | null = null;
    let last: State | null = first;
    for (const fragment of fragments) {
      if (last) {
        last.addEpsilon(fragment.in);
      } else {
        first = fragment.in;
      }
      last = fragment.out;
    }
    first = first || this.newState();
    return {
      in: first,
      out: last || first,
    };
  }

  choice(fragments: Frag[]): Frag {
    const frag = {
      in: this.newState(),
      out: this.newState(),
    };
    for (const fragment of fragments) {
      frag.in.addEpsilon(fragment.in);
      fragment.out.addEpsilon(frag.out);
    }
    return frag;
  }

  repeat(item: Frag): Frag {
    const frag = {
      in: this.newState(),
      out: this.newState(),
    };
    frag.in.addEpsilon(item.in);
    item.out.addEpsilon(frag.out);

    // Optimized *: just adds epsilon-transitions from input to the output, and back
    frag.in.addEpsilon(frag.out);
    frag.out.addEpsilon(frag.in);
    return frag;
  }

  repeat1(item: Frag): Frag {
    const frag = {
      in: this.newState(),
      out: this.newState(),
    };
    frag.in.addEpsilon(item.in);
    item.out.addEpsilon(frag.out);

    // Optimized +: just add epsilon-transition from the output to the input
    frag.out.addEpsilon(frag.in);
    return frag;
  }

  optional(item: Frag): Frag {
    const frag = {
      in: this.newState(),
      out: this.newState(),
    };
    frag.in.addEpsilon(item.in);
    item.out.addEpsilon(frag.out);

    // Optimized ?: just add epsilon-transition from the input to the output
    frag.in.addEpsilon(frag.out);
    return frag;
  }
}
