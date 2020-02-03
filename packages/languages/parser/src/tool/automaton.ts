import { State } from "./state";

export type Frag = {
  in: State;
  out: State;
};

export class Automaton {
  states: State[];

  constructor() {
    this.states = [new State(0)]; // So that state ids start at 1
  }

  newState(): State {
    const id = this.states.length;
    const state = new State(id);
    this.states.push(state);
    return state;
  }

  // [in] --ε--> [out]
  e() {
    const _in = this.newState();
    const _out = this.newState();
    _in.addEpsilon(_out);
    return { in: _in, out: _out };
  }

  // [in-a] --a--> [out-a] --ε--> [in-b] --b--> [out-b]
  alterationPair(first: Frag, second: Frag) {
    first.out.addEpsilon(second.in);
    return { in: first.in, out: second.out };
  }

  // Creates a alteration for (at least) two fragments
  alteration(first: Frag, ...fragments: Frag[]) {
    for (const fragment of fragments) {
      first = this.alterationPair(first, fragment);
    }
    return first;
  }

  // Creates a disjunction choice between two fragments
  orPair(first: Frag, second: Frag) {
    const _in = this.newState();
    const _out = this.newState();

    _in.addEpsilon(first.in);
    _in.addEpsilon(second.in);

    first.out.addEpsilon(_out);
    second.out.addEpsilon(_out);

    return { in: _in, out: _out };
  }

  // Creates a disjunction NFA for (at least) two fragments
  or(first: Frag, ...fragments: Frag[]) {
    for (const fragment of fragments) {
      first = this.orPair(first, fragment);
    }
    return first;
  }

  rep(item: Frag) {
    // This is needed for correctness
    const frag = {
      in: this.newState(),
      out: this.newState(),
    };
    frag.in.addEpsilon(item.in);
    item.out.addEpsilon(frag.out);

    // Optimized *: just adds ε-transitions from input to the output, and back
    frag.in.addEpsilon(frag.out);
    frag.out.addEpsilon(frag.in);
    return frag;
  }

  plusRep(item: Frag) {
    // This is needed for correctness
    const frag = {
      in: this.newState(),
      out: this.newState(),
    };
    frag.in.addEpsilon(item.in);
    item.out.addEpsilon(frag.out);

    // Optimized +: just add ε-transition from the output to the input
    frag.out.addEpsilon(frag.in);
    return frag;
  }

  question(item: Frag) {
    // This is needed for correctness
    const frag = {
      in: this.newState(),
      out: this.newState(),
    };
    frag.in.addEpsilon(item.in);
    item.out.addEpsilon(frag.out);

    // Optimized ?: just add ε-transition from the input to the output
    frag.in.addEpsilon(frag.out);
    return frag;
  }
}
