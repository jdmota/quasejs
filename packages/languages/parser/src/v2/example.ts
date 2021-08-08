import { inspect } from "util";
import { builder } from "./grammar/grammar-builder";
import { tool } from "./tool";

const {
  seq,
  choice,
  string,
  optional,
  repeat,
  repeat1,
  field,
  fieldMultiple,
  rule,
  id,
  object,
  select,
  int,
} = builder;

const ruleA =
  choice(
    seq(string("A"), string("B"), string("C")),
    seq(string("A"), string("D"))
  ) &&
  seq(
    optional(string("O")),
    choice(string("A"), string("B")),
    string("C"),
    repeat(seq(string("D"), string("E"))),
    repeat(string("F")),
    optional(string("O")),
    field("my_obj", object([["id", int(10)]])),
    select(id("my_obj"), "id"),
    select(id("my_obj"), "id")
  );

// && optional(string("O"));

// TODO refactor out the last statements that are equal at the end
// TODO the automaton optimization performs in essence left-refactoring, but we could also think about refactoring common right-parts (see issue above)
// TODO maybe to accomplish this, we can create an automaton minimization algorithm that only trying to perform the "left-refactoring" (with the epsilon closures and stuff) if there are conflicts, this way, we can handle the above issues, and generate code that is more similar to the original grammar

const ruleB = seq(
  choice(
    seq(string("A"), repeat(seq(string("B"), string("D")))),
    seq(string("A"), repeat(seq(string("C"), string("D"))))
  )
);

// const ruleB = seq(repeat(fieldMultiple("c", string("C"))), string("D"));

console.log("Starting...");

// TODO plan:
// Instead of starting by doing a lot of optimizations,
// we should first program the recognizer with optimized prediction

// TODO plan: start with a top-down parser, and when dealing with ambiguity, use Earley parser or LR(*)?

// TODO ideas:
// Longest or shortest match
// Greedy or non-greedy
// Prefer or avoid
// Accept or reject
// Precedence

const result = tool({
  name: "my_grammar",
  ruleDecls: [rule("A", ruleA, [], { start: true }, null)],
  tokenDecls: [],
});

if (result) {
  for (const [, code] of result.tokenCode) {
    console.log(code);
    console.log();
  }
  for (const [, code] of result.ruleCode) {
    console.log(code);
    console.log();
  }
  console.log(result.types);
  console.log();
}
