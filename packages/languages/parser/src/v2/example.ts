import fs from "node:fs";
import path from "node:path";
import { builder } from "./grammar/grammar-builder";
import { inferAndCheckTypes, tool } from "./tool";
import { TYPES_MACRO } from "./generators/generate-all";

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
  call,
  token,
  eof,
} = builder;

const ruleA = rule(
  "A",
  seq(
    optional(call("B", [])),
    optional(string("O")),
    choice(string("A"), string("B")),
    string("C"),
    repeat(seq(string("D"), string("E"))),
    repeat(string("F")),
    optional(string("O")),
    field("my_obj", object([["id", int(10)]])),
    select(id("my_obj"), "id"),
    select(id("my_obj"), "id"),
    call("C", [int(10), int(20)])
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

const ruleC = rule(
  "C",
  choice(
    field(
      "ret",
      object([
        ["x", id("x")],
        ["y", id("y")],
      ])
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
  id("ret")
);

const ruleD = rule(
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
);

const ruleE = rule(
  "E",
  field("obj", object([["num", int(10)]])),
  [],
  {},
  select(id("obj"), "num")
);

const ruleF = rule(
  "F",
  seq(
    choice(
      field("ret", object([["x", select(id("arg"), "x")]])),
      field("ret", object([["x", select(id("arg"), "x")]]))
    ),
    field("w", call("W", []))
  ),
  [rule.arg("arg")],
  {},
  id("w")
);

const ruleG = rule("G", choice(string("<<<"), string("<<")), [], {}, null);

const ruleTricky1 = rule(
  "Tricky1",
  choice(
    optional(call("Tricky1", [])),
    seq(string("A"), call("Tricky1", [])),
    seq(call("Tricky1", []), string("B"))
  ),
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

const tokenW = token(
  "W",
  field("text", string("W")),
  { type: "normal" },
  id("text")
);

// const ruleB = seq(repeat(fieldMultiple("c", string("C"))), string("D"));

// export type D_arg = Readonly<{ y: $rec1 }> & Readonly<{ x: $rec2 }> & Readonly<{ x: $rec3 }> & Readonly<{ y: $rec4 }>;
// export type D = Readonly<{ x: $rec2, y: $rec1 }> | Readonly<{ x: $rec4, y: $rec3 }>;

// export type D_arg = Readonly<{ x: $rec2 & $rec3, y: $rec1 & $rec4 }>;
// export type D = Readonly<{ x: $rec2, y: $rec1 }> | Readonly<{ x: $rec4, y: $rec3 }>;

// TODO: maybe the problem is that when making the type info "flow" from one store to another, we do not make the contents of objects flow as well...

console.log("Starting...");

const result = tool({
  name: "my_grammar",
  ruleDecls: [
    ruleA,
    ruleB,
    ruleC,
    ruleD,
    ruleE,
    ruleF,
    ruleG,
    ruleTricky1,
    ruleTricky2,
    ruleTricky3,
    ruleTricky4,
  ],
  tokenDecls: [tokenW],
});

if (result) {
  const { types, errors } = inferAndCheckTypes(result.grammar);
  fs.writeFileSync(
    path.join(__dirname, "example.gen.ts"),
    result.code.replace(TYPES_MACRO, types)
  );
  console.log("Type errors", errors);
  console.log();
}

// TODO right-optimize: the code should not be in the edges, it should be in the nodes?
// state1 ---x--> end
// state2 ---x--> end
// If x is epsilon code, we could optimize...
// Example in ruleA
