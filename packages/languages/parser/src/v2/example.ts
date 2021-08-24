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

// const ruleB = seq(repeat(fieldMultiple("c", string("C"))), string("D"));

// { x: T1, y: T2 } <: return
// { x: T3, y: T4 } <: return
// argument <: { x: T1 }
// argument <: { y: T2 }
// argument <: { x: T3 }
// argument <: { y: T4 }

// { x: T1, y: T2 } | { x: T3, y: T4 } <: return
// argument <: { x: T1 & T3, y: T2 & T4 }

// { x: unknown, y: bottom } <: return
// { x: bottom, y: unknown } <: return
// argument <: { x: unknown }
// argument <: { y: bottom }
// argument <: { x: bottom }
// argument <: { y: unknown }

// { x: unknown, y: bottom } | { x: bottom, y: unknown } <: return
// argument <: { x: unknown & bottom, y: bottom & unknown }

// TODO simplification:
// 1. remove cycles
// 2. remove the transitive edges
// 3. if the super type is something like {x:T1}, we join it with another {x:?}

// TODO idea:

// { x: KeyOf<argument, x>, y: KeyOf<argument, y> } <: return
// { x: KeyOf<argument, x>, y: KeyOf<argument, y> } <: return
// argument <: { x: T1 }
// argument <: { y: T2 }
// argument <: { x: T3 }
// argument <: { y: T4 }

// TODO but we need to connect KeyOf<argument, x> with all the T1 and T3 in { x: T1 } and { x: T3 }
// But maybe that means we don't need KeyOf<argument, x>, we can just do that directly!

// TODO or not...

//        A <: B
// -----------------------
// KeyOf<{x : A}, x> <: B

//   O <: {x : A}     A <: B
// ---------------------------
//     KeyOf<O, x> <: B

//   O <: {x : A}     B <: A
// ---------------------------
//     B <: KeyOf<O, x>

// KeyOf<{x : A & B}, x> <: C
// A & B <: C

// ...

// a <: b <: T2
// a <: T1

// How we connect T1 and T2?
// What we can actually do is say that a & T1 <: T2
// Because that is exactly what happens: for a member access, a <: {x:?}, but after that,
// the type is refined so we intersect with {x:?}

// If a <: T2 OR T1 <: T2 then a & T1 <: T2

console.log("Starting...");

const result = tool({
  name: "my_grammar",
  ruleDecls: [ruleA, ruleB, ruleC, ruleD, ruleE],
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
