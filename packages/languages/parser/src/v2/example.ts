import { builder } from "./grammar-builder";
import { getFields } from "./grammar-checker";

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
