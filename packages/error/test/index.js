import { beautify, getStack, locToString } from "../src";

const { SourceMapExtractor } = require( "@quase/source-map" );
const fs = require( "fs-extra" );

it( "getStack", () => {

  const cwd = process.cwd();

  function clean( string ) {
    return string.split( cwd ).join( "" ).replace( /\\/g, "/" ).split( "\n" ).filter( x => !/node_modules/.test( x ) ).join( "\n" );
  }

  expect( clean( getStack() ) ).toMatchSnapshot( "undefined" );
  expect( clean( getStack( -1 ) ) ).toMatchSnapshot( "-1" );
  expect( clean( getStack( 0 ) ) ).toMatchSnapshot( "0" );
  expect( clean( getStack( 1 ) ) ).toMatchSnapshot( "1" );
  expect( clean( getStack( 2 ) ) ).toMatchSnapshot( "2" );
  expect( clean( getStack( 3 ) ) ).toMatchSnapshot( "3" );

} );

it( "beautify", async() => {

  const stack = getStack();
  const extractor = new SourceMapExtractor( fs );

  expect( ( await beautify( stack, { extractor, ignore: /node_modules/ } ) ).stack ).toMatchSnapshot();

} );

it( "beautify with title", async() => {

  const stack = new Error( "title" ).stack;
  const extractor = new SourceMapExtractor( fs );

  expect( ( await beautify( stack, { extractor, ignore: /node_modules/ } ) ).stack ).toMatchSnapshot();

} );

it( "handle multine error message correctly", async() => {

  const stack = new Error( "multine\nerror\nmessage" ).stack;

  expect( ( await beautify( stack, { ignore: /node_modules/ } ) ).stack ).toMatchSnapshot();

} );

it( "handle just the title fine", async() => {

  const stack = "multine\nerror\nmessage";

  expect( ( await beautify( stack, { ignore: /node_modules/ } ) ).stack ).toMatchSnapshot();

} );

it( "keep at least one stack line", async() => {

  const stack = getStack( 2 );

  expect( ( await beautify( stack, { ignore: /node_modules/ } ) ).stack ).toMatchSnapshot();

} );

it( "locToString", () => {

  expect( locToString( {} ) ).toEqual( "" );
  expect( locToString( { line: 1 } ) ).toEqual( "1" );
  expect( locToString( { column: 2 } ) ).toEqual( "" );
  expect( locToString( { line: 1, column: 2 } ) ).toEqual( "1:2" );

} );
