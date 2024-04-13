import fs from "node:fs";
import path from "node:path";
import { builder } from "./grammar/grammar-builder";
import { typeBuilder } from "./grammar/type-checker/types-builder";
import { inferAndCheckTypes, tool } from "./tool";

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
  [],
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
      seq(string("A"), repeat(seq(string("C"), string("D"))))
    )
  ),
  [],
  {},
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

const ruleG = rule("G", choice(string("<<<"), string("<<")), [], {}, null);

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

const ruleTricky2 = rule(
  "Tricky2",
  choice(
    optional(field("x", call("Tricky2", []))),
    seq(string("A"), field("y", call("Tricky2", []))),
    seq(field("z", call("Tricky2", [])), string("B"))
  ),
  [],
  {},
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

const tokenW = token(
  "W",
  field("text", string("W")),
  [],
  { type: "normal", channels: ["channel1"] },
  id("text")
);

const tokenY = token(
  "TY",
  field("num", int(10)),
  [],
  { type: "normal", channels: ["channel1"] },
  id("num")
);

console.log("Starting...");

const result = tool({
  name: "my_grammar",
  ruleDecls: [
    ruleA,
    ruleB,
    ruleC,
    //ruleD,
    //ruleE,
    ruleF,
    ruleG,
    ruleH,
    ruleTricky1,
    ruleTricky2,
    ruleTricky3,
    ruleTricky4,
    ruleY,
    ruleRecursive1,
    ruleRecursive2,
    ruleRecursive3,
    ruleRecTricky1,
    ruleRecTricky2,
    ruleRecTricky3,
    ruleRecMutual1,
    ruleRecMutual2,
    ruleUsesEmpty,
    ruleEmpty,
    ruleEmptyOrNot,
    ruleTrickyAfterEmpty,
  ],
  tokenDecls: [tokenW, tokenY],
  startArguments: [],
  externalFuncReturns: {
    externalCall: typeBuilder.bool(),
  },
});

if (result) {
  const { types } = inferAndCheckTypes(result.grammar);
  fs.writeFileSync(
    path.join(import.meta.dirname, "example.gen.js"),
    result.code
  );
  fs.writeFileSync(path.join(import.meta.dirname, "example.gen.d.ts"), types);
  console.log();
}
