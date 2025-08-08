import fs from "node:fs";
import path from "node:path";
import { builder } from "../grammar/grammar-builder.ts";
import { typeBuilder } from "../grammar/type-checker/types-builder.ts";
import { type ToolInput, tool } from "../tool.ts";

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
  bool,
  int,
  call2,
  call,
  token,
  eof,
  empty,
  predicate,
} = builder;

const ruleA = rule(
  "A",
  seq(
    optional(field("B", call("B", []))),
    optional(string("O")),
    choice(string("A"), string("B")),
    string("C"),
    repeat(seq(fieldMultiple("D", string("D")), string("E"))),
    repeat(string("F")),
    optional(string("O")),
    field("my_obj", object([["id", int(10)]])),
    field("C", call("C", [int(10), int(20)])),
    field("T", call("Tricky2", []))
  ),
  [rule.arg("arg")],
  { start: true },
  object([
    ["o", id("my_obj")],
    ["b", id("B")],
    ["c", id("C")],
    ["d", id("D")],
    ["t", id("T")],
    ["external", call2("externalCall", [id("my_obj"), id("C")])],
  ])
);

const ruleB = rule(
  "B",
  seq(
    choice(
      seq(string("A"), repeat(seq(string("B"), string("D")))),
      seq(string("A"), repeat(seq(string("C"), string("D")))),
      seq(string("A"), repeat(seq(string("O"))))
    )
  ),
  [],
  {},
  null
);

const ruleParent = rule(
  "parent",
  seq(call("child", []), repeat(string("A"))),
  [],
  { _debug: { worthIt: true } },
  null
);

const ruleChild = rule(
  "child",
  repeat(string("A")),
  [],
  { _debug: { worthIt: true } },
  null
);

const ruleC = rule(
  "C",
  choice(
    seq(
      field("text", string("STRING")),
      field(
        "ret",
        object([
          ["x", id("x")],
          ["y", id("y")],
        ])
      )
    ),
    field(
      "ret",
      object([
        ["x", id("y")],
        ["y", id("x")],
      ])
    )
  ),
  [rule.arg("x"), rule.arg("y")],
  {},
  object([
    ["ret", id("ret")],
    ["text", id("text")],
  ])
);

/*const ruleD = rule(
  "D",
  choice(
    field(
      "ret",
      object([
        ["x", select(id("arg"), "x")],
        ["y", select(id("arg"), "y")],
      ])
    ),
    field(
      "ret",
      object([
        ["x", select(id("arg"), "y")],
        ["y", select(id("arg"), "x")],
      ])
    )
  ),
  [rule.arg("arg")],
  {},
  id("ret")
);*/

/*const ruleE = rule(
  "E",
  field("obj", object([["num", int(10)]])),
  [],
  {},
  select(id("obj"), "num")
);*/

const ruleF = rule(
  "F",
  seq(
    choice(
      field("ret", object([["x", id("arg")]])),
      field("ret", object([["x", id("arg")]]))
    ),
    field("w", call("W", [])),
    call("H", [int(10)])
  ),
  [rule.arg("arg")],
  {},
  id("w")
);

// TODO restore "<<<" | "<<"
const ruleG = rule("G", choice(string("<<"), string("<<")), [], {}, null);

const ruleH = rule(
  "H",
  choice(field("y", id("x")), field("y", string("a"))),
  [rule.arg("x")],
  {},
  id("y")
);

const ruleTricky1 = rule(
  "Tricky1",
  choice(
    seq(int(1), optional(call("Tricky1", [])), int(10)),
    seq(int(2), string("A"), call("Tricky1", []), int(20)),
    seq(int(3), call("Tricky1", []), string("B"), int(30))
  ),
  [],
  { _debug: { worthIt: true, keepGoing: true } },
  null
);

const ruleTricky2 = rule(
  "Tricky2",
  choice(
    empty(),
    seq(string("A"), field("y", call("Tricky2", []))),
    seq(field("z", call("Tricky2", [])), string("B"))
  ),
  [],
  { _debug: { worthIt: true } },
  null
);

const ruleTricky3 = rule(
  "Tricky3",
  choice(
    optional(field("x", call("Tricky3", [int(10)]))),
    seq(string("A"), field("y", call("Tricky3", [int(20)]))),
    seq(field("z", call("Tricky3", [int(30)])), string("B"))
  ),
  [rule.arg("arg")],
  {},
  null
);

const ruleTricky4 = rule(
  "Tricky4",
  seq(
    choice(
      optional(call("Tricky4", [])),
      seq(string("A"), call("Tricky4", [])),
      seq(call("Tricky4", []), string("B"))
    ),
    eof()
  ),
  [],
  {},
  null
);

const ruleRecTricky1 = rule(
  "RecTricky1",
  choice(
    seq(int(1), optional(call("RecTricky2", [])), int(10)),
    seq(int(2), string("A"), call("RecTricky2", []), int(20)),
    seq(int(3), call("RecTricky2", []), string("B"), int(30))
  ),
  [],
  {},
  null
);

const ruleRecTricky2 = rule("RecTricky2", call("RecTricky1", []), [], {}, null);

const ruleRecTricky3 = rule(
  "RecTricky3",
  choice(call("RecTricky2", []), string("C")),
  [],
  {},
  null
);

const ruleRecMutual1 = rule(
  "RecMutual1",
  // Lookahead of this call should be {B, C}
  choice(call("RecMutual2", []), string("B")),
  [],
  {},
  null
);

const ruleRecMutual2 = rule(
  "RecMutual2",
  // Lookahead of this call should be {B, C}
  choice(call("RecMutual1", []), string("C")),
  [],
  {},
  null
);

const ruleGLLTest1 = rule(
  "GLL1",
  seq(
    choice(call("GLLAux1", []), call("GLLAux2", [])),
    string("O"),
    string("W")
  ),
  [],
  { _debug: { worthIt: true, keepGoing: true } },
  null
);

const ruleGLLAux1 = rule(
  "GLLAux1",
  seq(string("A")),
  [],
  { _debug: { worthIt: true, keepGoing: true } },
  null
);

const ruleGLLAux2 = rule(
  "GLLAux2",
  seq(string("B"), string("C")),
  [],
  { _debug: { worthIt: true, keepGoing: true } },
  null
);

// Important regression tests
const ruleGLLFollowTest1 = rule(
  "GLL1Follow",
  choice(seq(int(1), call("GLLAux1", [])), seq(int(2), call("GLLAux1", []))),
  [],
  { _debug: { worthIt: true, keepGoing: true } },
  null
);

const ruleGLLFollowContextTest1 = rule(
  "GLL1FollowContext",
  seq(
    call("GLL1Follow", []),
    call("GLLAux1", []),
    optional(call("GLLAux1", [])),
    string("O")
  ),
  [],
  { _debug: { worthIt: true, keepGoing: true } },
  null
);

const ruleGLLAuxOptional1 = rule(
  "GLLAuxOptional1",
  optional(string("A")),
  [],
  { _debug: { worthIt: true, keepGoing: true } },
  null
);

// Important regression tests
const ruleGLLFollowTest2 = rule(
  "GLL1Follow2",
  choice(seq(int(1), call("GLLAuxOptional1", [])), int(2)),
  [],
  { _debug: { worthIt: true, keepGoing: true } },
  null
);

const ruleGLLFollowContextTest2 = rule(
  "GLL1FollowContext2",
  seq(call("GLL1Follow2", []), call("GLLAuxOptional1", []), string("O")),
  [],
  { _debug: { worthIt: true, keepGoing: true } },
  null
);

const ruleUsesEmpty = rule(
  "UsesEmpty",
  choice(
    seq(call("Empty", []), string("A"), call("Empty", []), string("B")),
    seq(string("A"), string("C"))
  ),
  [],
  {},
  null
);

const ruleEmpty = rule("Empty", empty(), [], {}, null);

const ruleEmptyOrNot = rule(
  "EmptyOrNot",
  choice(empty(), string("O")),
  [],
  {},
  null
);

const ruleTrickyAfterEmpty = rule(
  "TrickyAfterEmpty",
  choice(
    seq(call("EmptyOrNot", []), call("Tricky1", [])),
    seq(string("O"), string("P"))
  ),
  [],
  {},
  null
);

const ruleY = rule("Y", field("y", call("TY", [])), [], {}, id("y"));

const ruleRecursive1 = rule("Rec1", call("Rec1", []), [], {}, int(10));

const ruleRecursive2 = rule(
  "Rec2",
  optional(call("Rec2", [])),
  [],
  {},
  int(10)
);

const ruleRecursive3 = rule(
  "Rec3",
  choice(call("Rec3", []), string("A")),
  [],
  {},
  int(10)
);

const ruleRecursive4 = rule(
  "Rec4",
  choice(seq(call("Rec4", []), string("A")), string("B")),
  [],
  {},
  int(10)
);

const follow3 = rule(
  "follow3",
  seq(call("follow2", []), string("A"), string("A"), string("A")),
  [],
  {}
);
const follow2 = rule("follow2", call("follow1", []), [], {});
const follow1 = rule("follow1", call("follow0", []), [], {});
const follow0 = rule(
  "follow0",
  choice(field("a", int(0)), field("a", int(1))),
  [],
  { _debug: { worthIt: true, keepGoing: true } }
);

const grammarEnd = rule("end", seq(call("endAux", []), string("A")), [], {
  _debug: { worthIt: true, keepGoing: true },
});

const grammarNotEnd = rule(
  "notEnd",
  seq(call("endAux", []), string("A"), string("B"), string("C")),
  [],
  {
    _debug: { worthIt: true, keepGoing: true },
  }
);

const endAux = rule("endAux", choice(int(1), int(2)), [], {
  _debug: { worthIt: true, keepGoing: true },
});

const predicates1 = rule(
  "predicates1",
  choice(
    seq(predicate(bool(false)), string("A")),
    seq(predicate(bool(true)), string("B"))
  )
);

const predicates2 = rule(
  "predicates2",
  choice(
    seq(predicate(bool(false)), string("A")),
    seq(predicate(bool(true)), string("A"))
  )
);

// TODO restore string("W")
const tokenW = token(
  "W",
  field("text", string("1W")),
  [],
  { type: "normal", channels: ["channel1"] },
  id("text")
);

// TODO report errors on empty tokens!
const tokenY = token(
  "TY",
  field("num", int(10)),
  [],
  { type: "normal", channels: ["channel1"] },
  id("num")
);

const emptyRules = new Set([
  "C",
  "Tricky2",
  "Tricky1",
  "Tricky3",
  "Rec2",
  "RecTricky1",
  "RecTricky2",
  "Empty",
  "EmptyOrNot",
]);

console.log("Starting...");

const opts: ToolInput = {
  name: "my_grammar",
  ruleDecls: [
    ruleA,
    ruleB,
    ruleC,
    ruleParent,
    ruleChild,
    //ruleD,
    //ruleE,
    ruleF,
    ruleG,
    ruleH,
    ruleTricky1,
    ruleTricky2,
    ruleTricky3,
    ruleTricky4,
    // TODO restore ruleY,
    ruleRecursive1,
    ruleRecursive2,
    ruleRecursive3,
    ruleRecursive4,
    ruleRecTricky1,
    ruleRecTricky2,
    ruleRecTricky3,
    ruleRecMutual1,
    ruleRecMutual2,
    ruleUsesEmpty,
    ruleEmpty,
    ruleEmptyOrNot,
    ruleTrickyAfterEmpty,
    ruleGLLTest1,
    ruleGLLAux1,
    ruleGLLAux2,
    ruleGLLFollowTest1,
    ruleGLLFollowContextTest1,
    ruleGLLFollowTest2,
    ruleGLLFollowContextTest2,
    ruleGLLAuxOptional1,
    follow3,
    follow2,
    follow1,
    follow0,
    grammarEnd,
    grammarNotEnd,
    endAux,
    predicates1,
    predicates2,
  ],
  tokenDecls: [
    tokenW,
    tokenY, // This adds ambiguity in the tokenizer
  ],
  startArguments: [typeBuilder.string()],
  externalFuncReturns: {
    externalCall: typeBuilder.bool(),
  },
  parser: {
    maxLL: 3,
    maxFF: 3,
  },
  tokenizer: {
    maxLL: 1,
    maxFF: 0,
  },
};

console.time("REF-BENCHMARK");
const resultReference = tool({
  ...opts,
  _useReferenceAnalysis: true,
});
console.timeEnd("REF-BENCHMARK");

console.time("BENCHMARK");
const result = tool(opts);
console.timeEnd("BENCHMARK");

if (result) {
  fs.writeFileSync(
    path.join(import.meta.dirname, "example.gen.mjs"),
    result.code
  );
  fs.writeFileSync(
    path.join(import.meta.dirname, "example.analysis.txt"),
    result.grammar._debugAnalysis.join("\n")
  );
  fs.writeFileSync(
    path.join(import.meta.dirname, "example.gen.d.mts"),
    result.types
  );
}

if (resultReference) {
  fs.writeFileSync(
    path.join(import.meta.dirname, "example.reference.gen.mjs"),
    resultReference.code
  );
  fs.writeFileSync(
    path.join(import.meta.dirname, "example.reference.analysis.txt"),
    resultReference.grammar._debugAnalysis.join("\n")
  );
}

// yarn n packages/parser/__examples__/example.ts > packages/parser/__examples__/example.txt
