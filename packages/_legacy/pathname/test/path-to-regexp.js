import pathToRegExp from "../src/path-to-regexp";
import assert from "./_assert";

it( "pathToRegExp", () => {

  assert.throws( () => {
    pathToRegExp( "/***" );
  }, new SyntaxError( "*** not allowed at 1" ) );

  assert.throws( () => {
    pathToRegExp( "/a\\" );
  }, new SyntaxError( "Unexpected end of input" ) );

  assert.throws( () => {
    pathToRegExp( "/<a" );
  }, new SyntaxError( "Unexpected end of input" ) );

  assert.throws( () => {
    pathToRegExp( "/<+" );
  }, new SyntaxError( "Expected a valid identifier at 2" ) );

  assert.throws( () => {
    pathToRegExp( "/<abc)" );
  }, new SyntaxError( "Expected > but saw ) at 5" ) );

  assert.throws( () => {
    pathToRegExp( "/(a|b" );
  }, new SyntaxError( "Unexpected end of input: missing )" ) );

  assert.throws( () => {
    pathToRegExp( "/[ab" );
  }, new SyntaxError( "Unexpected end of input: missing ]" ) );

  assert.throws( () => {
    pathToRegExp( "/[ab]]" );
  }, new SyntaxError( "Unexpected token at 5" ) );

  assert.deepEqual( pathToRegExp( "/**", { ast: true } ).ast, {
    type: "Pattern",
    body: [
      { type: "Slash" },
      { type: "Globstar" }
    ]
  } );

  assert.deepEqual( pathToRegExp( "/**" ).onlyMatchDir, false );
  assert.deepEqual( pathToRegExp( "/**/" ).onlyMatchDir, true );
  assert.deepEqual( pathToRegExp( "/**///" ).onlyMatchDir, true );

  assert.strictEqual( pathToRegExp( "/abc", { base: false } ).base, null );

  assert.strictEqual( pathToRegExp( "/abc" ).base, "/abc" );
  assert.strictEqual( pathToRegExp( "/**" ).base, "/" );
  assert.strictEqual( pathToRegExp( "/**/" ).base, "/" );
  assert.strictEqual( pathToRegExp( "/a/**" ).base, "/a" );
  assert.strictEqual( pathToRegExp( "/a/**/" ).base, "/a" );
  assert.strictEqual( pathToRegExp( "/a/b(c|d)" ).base, "/a" );
  assert.strictEqual( pathToRegExp( "/abc/a/b(c|d)" ).base, "/abc/a" );
  assert.strictEqual( pathToRegExp( "///abc///a///b(c|d)//" ).base, "/abc/a" );

} );
