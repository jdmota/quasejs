import Grammar from "../src/generator";

const grammar = new Grammar(
  {
    FUN: "fun",
    END: "end",
    COMMA: ",",
    ARROW: "->",
    ID: /(i|d)(i|d|0|1|2)*/,
    NUM: /(0|1|2)+/,
    // EMPTY: /a?/,
    // ID: /[$_a-z][$_a-z0-9]*/i,
    // NUM: /[0-9]+/i
  },
  {
    START: "FUN ( params:ID ( comma:COMMA params:ID )* )? ARROW body:EXP END",
    EXP: "( stuff:NUM | stuff2:NUM* | ID )"
  }
);

let generation = grammar.generate();

console.log( generation );
console.log();
console.log( grammar.toString() );
console.log();
console.log( grammar.reportConflicts() );
console.log();

function test() {
  eval( `
    ${generation.replace( "@quase/parser", "../src" )}\n
    ${`
      let text="fun id1, id2 -> 10000 end";
      console.log(text);
      console.log();
      console.log(new Parser(text).parse());
      console.log();
    `}`
  );
}

test();

// yarn n packages/languages/parser/test

/* eslint no-eval: 0, no-console: 0 */
