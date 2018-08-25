import { beautify, getStack } from "../src";

const { SourceMapExtractor } = require( "@quase/source-map" );
const fs = require( "fs-extra" );

it( "getStack", () => {

  const cwd = process.cwd();

  function clean( string ) {
    return string.split( cwd ).join( "" ).replace( /\\/g, "/" );
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

  expect( ( await beautify( stack, extractor ) ).stack ).toMatchSnapshot( "dont ignore" );
  expect( ( await beautify( stack, extractor, { ignore: /node_modules/ } ) ).stack ).toMatchSnapshot( "ignore node_modules" );

} );

it( "beautify with title", async() => {

  const stack = new Error( "title" ).stack;
  const extractor = new SourceMapExtractor( fs );

  expect( ( await beautify( stack, extractor ) ).stack ).toMatchSnapshot( "dont ignore" );
  expect( ( await beautify( stack, extractor, { ignore: /node_modules/ } ) ).stack ).toMatchSnapshot( "ignore node_modules" );

} );

it( "keep at least one stack line", async() => {

  const stack = getStack( 2 );
  const extractor = new SourceMapExtractor( fs );

  expect( ( await beautify( stack, extractor, { ignore: /node_modules/ } ) ).stack ).toMatchSnapshot();

} );
