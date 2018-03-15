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

export default async function( { context, fullPath, publicPath, finalAssets: { files, moduleToAssets }, minify }: RuntimeArg ): Promise<string> {

  const relative = ( path.relative( path.dirname( fullPath ), context ).replace( /\\/g, "/" ) || "." ) + "/";

  const p = fs.readFile( runtimePath, "utf8" );

  const fileToIdx = {};
  const $files = files.map( ( m, i ) => {
    fileToIdx[ m.relativeDest ] = i;
    return m.relativeDest;
  } );

  const $idToFiles = {};
  for ( const [ hashId, files ] of moduleToAssets ) {
    $idToFiles[ hashId ] = files.map( f => fileToIdx[ f.relativeDest ] );
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
