import { inspect } from "util";
import { builder } from "./grammar/grammar-builder";
import { Automaton, Frag } from "./automaton/automaton";
import { FactoryRule } from "./factories/factory-rule";
import { NfaToDfa, DfaMinimizer } from "./optimizer/optimizer";
import { CfgToCode } from "./generators/graph-to-code/cfg-to-code";
import { CodeToString } from "./generators/graph-to-code/code-to-string";
import { formatRule } from "./formaters/formater";

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

const ruleA = seq(
  choice(string("A"), string("B")),
  string("C"),
  repeat(string("D"))
);

// const ruleB = seq(repeat(fieldMultiple("c", string("C"))), string("D"));

const automaton = new Automaton();
const ruleFactory = new FactoryRule(automaton);
const frag = ruleFactory.gen(ruleA);

const nfaToDfa = new NfaToDfa();
const dfaMinimzer = new DfaMinimizer();

function minimize(frag: Frag) {
  return dfaMinimzer.minimize(
    nfaToDfa.do({
      start: frag.in,
      acceptingSet: new Set([frag.out]),
    })
  );
}

const cfgToCode = new CfgToCode();
const codeToString = new CodeToString();

const minimized = minimize(frag);

const code = cfgToCode.process(minimized.states.slice(1));

console.log(formatRule(ruleA));
console.log();
console.log(codeToString.render("", code));
