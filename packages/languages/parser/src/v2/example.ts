import { inspect } from "util";
import { builder } from "./grammar/grammar-builder";
import { Automaton, Frag } from "./automaton/automaton";
import { FactoryRule } from "./factories/factory-rule";
import { NfaToDfa, DfaMinimizer } from "./optimizer/optimizer";
import { CfgToCode } from "./generators/dfa-to-code/cfg-to-code";
import { CodeToString } from "./generators/dfa-to-code/code-to-string";
import { formatRule } from "./formaters/formater";
import { Analyzer } from "./analysis/analysis";

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

const ruleA =
  choice(
    seq(string("A"), string("B"), string("C")),
    seq(string("A"), string("D"))
  ) ||
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

const minimized = minimize(frag);

const analyzer = new Analyzer({
  startRule: "",
  initialStates: new Map(),
  follows: new Map(),
});

console.log(analyzer.analyze("", minimized.start).toString());

const cfgToCode = new CfgToCode();
const codeToString = new CodeToString();

const code = cfgToCode.process(minimized);

console.log(formatRule(ruleA));
console.log();
console.log(codeToString.render("", code));
