// @flow
import type { FinalAssets } from "../types";

const path = require( "path" );
const fs = require( "fs-extra" );
const babel = require( "@babel/core" );
const runtimePath = require.resolve( "./runtime" );

export type RuntimeArg = {
  context: string,
  fullPath: string,
  publicPath: string,
  finalAssets: FinalAssets,
  minify?: ?boolean
};

export const chunkInit = babel.transformSync(
  `"use strict";( {
    g: "undefined" == typeof self ? Function( "return this" )() : self,
    p( m ) {
      ( this.g.__quase_builder__ = this.g.__quase_builder__ || { q: [] } ).q.push( m )
    }
  } )`,
  {
    babelrc: false,
    configFile: false,
    minified: true
  }
).code.replace( /;$/, "" );

export const moduleArgs = "$e,$r,$i,$g,$a".split( "," );

export default async function( { context, fullPath, publicPath, finalAssets: { files, moduleToAssets }, minify }: RuntimeArg ): Promise<string> {

  const relative = ( path.relative( path.dirname( fullPath ), context ).replace( /\\/g, "/" ) || "." ) + "/";

  const p = fs.readFile( runtimePath, "utf8" );

  const fileToIdx = {};
  const $files = files.map( ( f, i ) => {
    fileToIdx[ f.relative ] = i;
    return f.relative;
  } );

  const $idToFiles = {};
  for ( const [ hashId, files ] of moduleToAssets ) {
    $idToFiles[ hashId ] = files.map( f => fileToIdx[ f.relative ] );
  }

  let input = await p;
  input = input.replace( "$_FILES", `${JSON.stringify( $files )}.map( p => publicPath + p )` );
  input = input.replace( "$_MODULE_TO_FILES", JSON.stringify( $idToFiles ) );

  if ( relative === publicPath ) {
    input = input.replace( "$_PUBLIC_PATH", JSON.stringify( relative ) );
  } else {
    input = input.replace( "$_PUBLIC_PATH", `isNode ? ${JSON.stringify( relative )} : ${JSON.stringify( publicPath )}` );
  }

  const minified = minify === undefined ? true : !!minify;

  const { code } = babel.transformSync( input, {
    babelrc: false,
    configFile: false,
    sourceType: "module",
    presets: [
      require( "./babel-preset" ).default
    ].concat( minified ? [ [ require( "babel-preset-minify" ), { evaluate: false } ] ] : [] ),
    comments: false,
    sourceMaps: false,
    ast: false,
    minified
  } );

  return code.trim();
}
