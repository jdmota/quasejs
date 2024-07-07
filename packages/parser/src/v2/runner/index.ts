import { never } from "../../../../util/miscellaneous.ts";
import type { Grammar } from "../grammar/grammar.ts";

type SomeTransition =
  | {
      type: "string";
      string: string;
    }
  | {
      type: "eof";
    }
  | {
      type: "rule";
      name: string;
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
  transitions: [SomeTransition, SomeState][];
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

type StackData = { readonly [key: string]: unknown };

class Stack {
  readonly parent: Stack | null;
  readonly data: StackData;
  readonly returnValue: StackData;

  constructor(parent: Stack | null, data: StackData, returnValue: StackData) {
    this.parent = parent;
    this.data = data;
    this.returnValue = returnValue;
  }

  static new() {
    return new Stack(null, {}, {});
  }

  push() {
    return new Stack(this, {}, {});
  }

  pop() {
    const parent = this.parent;
    if (parent == null) {
      throw new Error("Empty stack");
    }
    return new Stack(parent.parent, parent.data, this.data);
  }

  field(name: string, value: unknown) {
    return new Stack(
      this.parent,
      {
        ...this.data,
        [name]: value,
      },
      this.returnValue
    );
  }
}

function matches(current: string, transition: string) {
  return current === transition; // TODO
}

type MachineState = readonly [SomeState, InputState, Stack];

function run(state: SomeState, input: InputState, stack: Stack) {
  let prev: MachineState[] = [[state, input, stack]];
  let next: MachineState[] = [];
  let oks: MachineState[] = [];
  let errors: MachineState[] = [];

  while (true) {
    for (const [state, input, stack] of prev) {
      for (const [transition, dest] of state.transitions) {
        switch (transition.type) {
          case "string": {
            if (!input.end && matches(input.get(), transition.string)) {
              next.push([dest, input.move(), stack]);
            } else {
              errors.push([dest, input, stack]);
            }
            break;
          }
          case "eof": {
            if (input.end) {
              oks.push([dest, input, stack]);
            } else {
              errors.push([dest, input, stack]);
            }
            break;
          }
          case "rule": {
            next.push([dest, input, stack.push()]);
            break;
          }
          case "field": {
            next.push([
              dest,
              input,
              stack.field(transition.name, stack.returnValue),
            ]);
            break;
          }
          case "action": {
            next.push([dest, input, stack]);
            break;
          }
          case "return": {
            next.push([dest, input, stack.pop()]);
            break;
          }
          case "predicate": {
            next.push([dest, input, stack]);
            break;
          }
          case "precedence": {
            next.push([dest, input, stack]);
            break;
          }
          default:
            never(transition);
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
  transitions: [
    [
      { type: "string", string: "a" },
      {
        transitions: [
          [
            { type: "string", string: "b" },
            {
              transitions: [
                [
                  { type: "string", string: "c" },
                  { transitions: [[{ type: "eof" }, { transitions: [] }]] },
                ],
              ],
            },
          ],
        ],
      },
    ],
  ],
};

console.log("Start");
console.log("Ok", run(example, new InputState("abc", 0), Stack.new()).oks);
console.log("Error", run(example, new InputState("ab", 0), Stack.new()).errors);
console.log("Error", run(example, new InputState("ac", 0), Stack.new()).errors);

export function parse(grammar: Grammar, input: string) {
  const start = grammar.getRule(grammar.startRule.name);
  run({ transitions: [] }, new InputState(input, 0), Stack.new());
  // TODO expect eof
}

// TODO work first in building a kind of "interpreter" that if necessary, run many recognizers in parallel
// TODO implement error recovery, and filling the missing tokens
// TODO implement incremental parsings
// TODO follow left recursion removal as in https://www.antlr.org/papers/allstar-techreport.pdf
