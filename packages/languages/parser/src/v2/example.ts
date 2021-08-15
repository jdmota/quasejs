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
  call2,
} = builder;

const ruleA = rule(
  "A",
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
  ),
  [],
  { start: true },
  call2("externalCall", [id("my_obj")])
);

const ruleB = rule(
  "B",
  seq(
    choice(
      seq(string("A"), repeat(seq(string("B"), string("D")))),
      seq(string("A"), repeat(seq(string("C"), string("D"))))
    )
  ),
  [],
  {},
  null
);

// const ruleB = seq(repeat(fieldMultiple("c", string("C"))), string("D"));

console.log("Starting...");

const result = tool({
  name: "my_grammar",
  ruleDecls: [ruleA, ruleB],
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
