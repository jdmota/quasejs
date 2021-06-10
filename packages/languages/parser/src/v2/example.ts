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
} = builder;

const ruleA =
  choice(
    seq(string("A"), string("B"), string("C")),
    seq(string("A"), string("D"))
  ) &&
  seq(
    choice(string("A"), string("B")),
    string("C"),
    repeat(seq(string("D"), string("E"))),
    repeat(string("F"))
  );

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
  rules: [rule("A", ruleA, [], { start: true }, null)],
});

if (result) {
  for (const code of result.values()) {
    console.log(code);
  }
}
