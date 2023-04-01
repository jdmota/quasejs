import { builder } from "./grammar/grammar-builder";
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
  select,
  int,
  call2,
  call,
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
  choice(
    field("ret", object([["x", select(id("arg"), "x")]])),
    field("ret", object([["x", select(id("arg"), "x")]]))
  ),
  [rule.arg("arg")],
  {},
  id("ret")
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

// obj <: {x: T1}
// T1 <: obj.x

// obj <: {x: T2}
// T2 <: obj.x

// TODO How to say that T1 = T2?

// obj <: {x: T1+ & T2+}
// T1+ | T2+ <: obj.x
// T1+ <: obj.x (2) <: int

// TODO if two types appear in an intersecion, and have the same polarity, and one of them has the subset of the constraints of the other, they can be merged?

// export type D_arg = Readonly<{ y: $rec1 }> & Readonly<{ x: $rec2 }> & Readonly<{ x: $rec3 }> & Readonly<{ y: $rec4 }>;
// export type D = Readonly<{ x: $rec2, y: $rec1 }> | Readonly<{ x: $rec4, y: $rec3 }>;

// export type D_arg = Readonly<{ x: $rec2 & $rec3, y: $rec1 & $rec4 }>;
// export type D = Readonly<{ x: $rec2, y: $rec1 }> | Readonly<{ x: $rec4, y: $rec3 }>;

// TODO ok, when adding a new constraint, see if there is there one already similar, and just reuse it?

// TODO 18Feb - let's do the following, when inferring constraints for obj.x, the component type should be equal to the type of this expression
// TODO 18Feb - maybe the problem is that when making the type info "flow" from one store to another, we do not make the contents of objects flow as well...
// TODO 18Feb - maybe the solution is just to simplify the generic entry types...

console.log("Starting...");

const result = tool({
  name: "my_grammar",
  ruleDecls: [ruleA, ruleB, ruleC, ruleD, ruleE, ruleF],
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
  console.log(inferAndCheckTypes(result.grammar));
  console.log();
}
