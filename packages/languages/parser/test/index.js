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
    `
    @lexer
    FUN: 'fun';
    END: 'end';
    COMMA: ',';
    ARROW: '->';
    fragment ID_START: /[a-zA-Z]/;
    fragment ID_CHAR: /[a-zA-Z0-9]/;
    ID: ID_START ID_CHAR*;
    NUM: /[0-9]+/;

    @parser
    start PROGRAM: FUN ( params+=ID ( COMMA params+=ID )* )? ARROW body=EXP END;
    EXP: stuff=NUM | stuff=ID;
    `
  );

  const generation = grammar.generate();
  const conflicts = grammar.reportConflicts();

  expect( generation ).toMatchSnapshot( "generation" );
  expect( conflicts ).toMatchSnapshot( "conflicts" );

  expect( runParser( generation, "fun id1, id2 -> 10000 end" ) ).toMatchSnapshot( "ast" );
  expect( runParser( generation, "fun id1 -> id1 end" ) ).toMatchSnapshot( "ast" );
  expect( runParser( generation, "fun id1 -> id1" ) ).toMatchSnapshot( "ast" );

} );

it( "supports empty", () => {

  const grammar = new Grammar(
    `
    start RULE1 : 'A' | ;
    `
  );

  const generation = grammar.generate();
  const conflicts = grammar.reportConflicts();

  expect( generation ).toMatchSnapshot( "generation" );
  expect( conflicts ).toMatchSnapshot( "conflicts" );

} );

it( "check conflicts on repetitions", () => {

  const grammar = new Grammar(
    `
    start RULE1 : 'A'* 'A' RULE2;
    RULE2 : 'B'+ 'B';
    `
  );

  const generation = grammar.generate();
  const conflicts = grammar.reportConflicts();

  expect( generation ).toMatchSnapshot( "generation" );
  expect( conflicts ).toMatchSnapshot( "conflicts" );

} );
