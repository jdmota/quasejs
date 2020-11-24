import { builder } from "./grammar-builder";
import { getAstType, getAstFields } from "./grammar-checker";
import {
  astTypeToString,
  astFieldsToString,
  emptyAstFields,
} from "./grammar-types";

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

console.log(astFieldsToString(getAstFields(ruleA, emptyAstFields)));
console.log(astFieldsToString(getAstFields(ruleB, emptyAstFields)));

class Parser {
  string(arg) {}

  choice(...args) {}

  rule1() {
    this.string("a");
    this.string("a");
    this.choice(
      () => {
        this.string("B");
      },
      () => {
        this.string("B");
      }
    );
  }
}
