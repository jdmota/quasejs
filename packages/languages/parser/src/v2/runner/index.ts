import type { Grammar } from "../grammar/grammar";

type SomeTransition =
  | {
      type: "string";
      string: string;
    }
  | {
      type: "field";
      name: string;
    }
  | {
      type: "action";
      code: string;
    }
  | {
      type: "return";
      code: string;
    }
  | {
      type: "predicate";
      code: string;
    }
  | {
      type: "precedence";
      code: string;
    };

type SomeState = {
  transitions: ReadonlyMap<string, SomeState>;
};

class InputState {
  readonly input: string;
  readonly index: number;
  readonly end: boolean;

  constructor(input: string, index: number) {
    this.input = input;
    this.index = index;
    this.end = input.length === index;
  }

  get() {
    return this.input[this.index] || "";
  }

  move() {
    return new InputState(this.input, this.index + 1);
  }
}

type StackNode<T> = {
  data: T;
  parent: StackNode<T> | null;
};

class Stack {
  private last: StackNode<any> | null;

  constructor(last: StackNode<any> | null) {
    this.last = last;
  }

  push(data: any) {
    const node = {
      data,
      parent: this.last,
    };
    this.last = node;
    return node;
  }

  pop() {
    const last = this.last;
    if (last == null) {
      throw new Error("Empty stack");
    }
    this.last = last.parent;
    return last.data;
  }

  clone() {
    return new Stack(this.last);
  }
}

function matches(current: string, transition: string) {
  return current === transition; // TODO
}

function run(state: SomeState, input: InputState, stack: Stack) {
  let prev: [SomeState, InputState, Stack][] = [[state, input, stack]];
  let next: [SomeState, InputState, Stack][] = [];
  let oks: [SomeState, InputState, Stack][] = [];
  let errors: [SomeState, InputState, Stack][] = [];

  while (true) {
    for (const [state, input, stack] of prev) {
      for (const [transition, dest] of state.transitions) {
        if (matches(input.get(), transition)) {
          if (input.end) {
            oks.push([dest, input, stack]);
          } else {
            next.push([dest, input.move(), stack]);
          }
        } else {
          errors.push([dest, input, stack]);
        }
      }
    }
    if (next.length === 0) break;
    prev = next;
    next = [];
    errors = [];
  }

  if (oks.length > 0) {
    errors = [];
  }

  return {
    oks,
    errors,
    next,
  };
}

const example: SomeState = {
  transitions: new Map([
    [
      "a",
      {
        transitions: new Map([
          [
            "b",
            {
              transitions: new Map([
                [
                  "c",
                  { transitions: new Map([["", { transitions: new Map() }]]) },
                ],
              ]),
            },
          ],
        ]),
      },
    ],
  ]),
};

console.log("Start");
console.log("Ok", run(example, new InputState("abc", 0), new Stack(null)).oks);
console.log(
  "Error",
  run(example, new InputState("ab", 0), new Stack(null)).errors
);
console.log(
  "Error",
  run(example, new InputState("ac", 0), new Stack(null)).errors
);

export function parse(grammar: Grammar, input: string) {
  const start = grammar.getRule(grammar.startRule);
  run({ transitions: new Map() }, new InputState(input, 0), new Stack(null));
  // TODO expect eof
}

// TODO work first in building a kind of "interpreter" that if necessary, run many recognizers in parallel
// TODO implement error recovery, and filling the missing tokens
// TODO implement incremental parsings
// TODO follow left recursion removal as in https://www.antlr.org/papers/allstar-techreport.pdf
