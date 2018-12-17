import Grammar from "../src/generator/grammar";

function runParser( generation, text ) {
  let result;
  /* eslint no-eval: 0 */
  eval( `
    ${generation.replace( "@quase/parser", "../src" )}\n
    ${`
      try {
        result = new Parser(${JSON.stringify( text )}).parse();
      } catch ( err ) {
        result = err.message;
      }
    `}`
  );
  return result;
}

it( "basic", () => {

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
      START: "FUN ( params:ID ( COMMA params:ID )* )? ARROW body:EXP END",
      EXP: "( stuff:NUM | stuff:ID )"
    }
  );

  const generation = grammar.generate();
  const conflicts = grammar.reportConflicts();

  expect( generation ).toMatchSnapshot( "generation" );
  expect( conflicts ).toMatchSnapshot( "conflicts" );

  expect( runParser( generation, "fun id1, id2 -> 10000 end" ) ).toMatchSnapshot( "ast" );
  expect( runParser( generation, "fun id1 -> id1 end" ) ).toMatchSnapshot( "ast" );
  expect( runParser( generation, "fun id1 -> id1" ) ).toMatchSnapshot( "ast" );

} );

it( "check conflicts on repetitions", () => {

  const grammar = new Grammar(
    {
      A: "A",
      B: "B",
    },
    {
      RULE1: "A* A RULE2",
      RULE2: "B+ B"
    }
  );

  const generation = grammar.generate();
  const conflicts = grammar.reportConflicts();

  expect( generation ).toMatchSnapshot( "generation" );
  expect( conflicts ).toMatchSnapshot( "conflicts" );

} );
