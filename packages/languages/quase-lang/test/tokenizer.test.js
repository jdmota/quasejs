// @flow
import { Tokenizer } from "../src/frontend/tokenizer";

declare function test( a: any, b: any ): void;
declare function expect( a: any ): any;

test( "basic", () => {

  const input = "val a = 10 // abc";
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();
  expect( tokenizer.getComments() ).toMatchSnapshot();

} );

test( "skip hashbang", () => {

  const input = "#! abc\nval a = 10 // abc";
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();
  expect( tokenizer.getComments() ).toMatchSnapshot();

} );

test( "regexp", () => {

  const input = "val a = #/[/]/g";
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();

} );

test( "char constant", () => {

  const input = "val a = 'a'";
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();

} );

test( "char constant empty", () => {

  const input = "val a = ''";
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();

} );

test( "char constant with escape", () => {

  const input = "val a = '\\n'";
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();

} );

test( "string constant", () => {

  const input = 'val a = "aaaa"';
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();

} );

test( "string constant with escape", () => {

  const input = 'val a = "a\\"aa"';
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();

} );


test( "string constant with new line", () => {

  const input = 'val a = "a\naa"';
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();

} );

test( "string template", () => {

  const input = 'val a = "${a}"'; // eslint-disable-line
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();

} );

test( "string template with string inside", () => {

  const input = 'val a = "${"a"}"'; // eslint-disable-line
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();

} );

test( "string template back quote", () => {

  const input = 'val a = `"`';
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();

} );

test( "string template with spaces", () => {

  const input = 'val a = ` " `';
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();

} );

test( "numbers", () => {

  const input = "a( 0, 0.0, 0b0, 0b1, 0B0, 0B1, 0x0, 0x1, 0X0, 0X1, 0o0, 0o1, 0O0, 0O1, 0n, 0_0_0 );";
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();

} );

test( "dont confuse with !is", () => {

  const input = "!isa;";
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();

} );

test( "dont confuse with !in", () => {

  const input = "!ina;";
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();

} );

test( "babel/babylon/issues/622", () => {

  const input = "a <!-- b"; // a < !(--b)
  const tokenizer = new Tokenizer( input );

  expect( tokenizer.getAllTokens() ).toMatchSnapshot();

} );
