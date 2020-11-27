import { builder } from "./grammar/grammar-builder";
import { getFields } from "./grammar/grammar-checker";
import { Grammar } from "./grammar/grammar";
import { generateTypes } from "./generators/generate-types";

const {
  seq,
  choice,
  string,
  optional,
  repeat,
  repeat1,
  field,
  fieldMultiple,
} = builder;

const ruleA = seq(field("a", string("A")), string("B"));

const ruleB = seq(repeat(fieldMultiple("c", string("C"))), string("D"));

console.log(getFields(ruleA));
console.log(getFields(ruleB));

const grammar = new Grammar(
  "grammarName",
  new Map([
    ["A", ruleA],
    ["B", ruleB],
  ]),
  "A"
);

console.log(generateTypes(grammar));
console.log(grammar.ambiguousFields);
