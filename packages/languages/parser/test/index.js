import tool from "../src/tool";

function runParser( generation, text ) {
  let result;
  /* eslint no-eval: 0 */
  eval( `
    ${generation.replace( "@quase/parser", "../src/runtime" )}\n
    result = new Parser(${JSON.stringify( text )}).parse();`
  );
  return result;
}

it( "basic", () => {

  const { code, conflicts } = tool(
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

  expect( code ).toMatchSnapshot( "code" );
  expect( conflicts ).toMatchSnapshot( "conflicts" );

  expect( runParser( code, "fun id1, id2 -> 10000 end" ) ).toMatchSnapshot( "ast" );
  expect( runParser( code, "fun id1 -> id1 end" ) ).toMatchSnapshot( "ast" );
  expect( () => runParser( code, "fun id1 -> id1" ) ).toThrowErrorMatchingSnapshot( "error" );

} );

it( "supports empty", () => {

  const { code, conflicts } = tool(
    `
    start RULE1 : 'A' | ;
    `
  );

  expect( code ).toMatchSnapshot( "code" );
  expect( conflicts ).toMatchSnapshot( "conflicts" );

} );

it( "optimized repetitions and nested rule on right side", () => {

  const { code, conflicts } = tool(
    `
    start RULE1 : 'A'* 'A' RULE2;
    RULE2 : 'B'+ 'B';
    `
  );

  expect( code ).toMatchSnapshot( "code" );
  expect( conflicts ).toMatchSnapshot( "conflicts" );

} );

it( "negative character class in regexp", () => {

  const { code, conflicts } = tool(
    `
    @lexer
    STRING: /"([^\\\\"]|\\\\[^])*"/;

    @parser
    start RULE1 : STRING;
    `
  );

  expect( code ).toMatchSnapshot( "code" );
  expect( conflicts ).toMatchSnapshot( "conflicts" );

} );

it( "typescript", () => {

  const { code } = tool(
    `
    @lexer
    ID: /[a-zA-Z][a-zA-Z0-9]*/;
    NUM: /[0-9]+/;

    @parser
    start PROGRAM: 'fun' ( params+=ID ( ',' params+=ID )* )? '->' body=EXP 'end';
    EXP: stuff=NUM | stuff=ID;
    `,
    {
      typescript: true
    }
  );

  expect( code ).toMatchSnapshot( "code" );

} );

it( "actions", () => {

  const { code } = tool(
    `
    @lexer
    ID: /[a-zA-Z][a-zA-Z0-9]*/;
    NUM: /[0-9]+/;

    @parser
    start PROGRAM: ( id=ID { console.log("\\n",$id); if(true){} } )*;
    `
  );

  expect( code ).toMatchSnapshot( "code" );

} );
