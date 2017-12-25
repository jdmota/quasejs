// @flow
import babelBuildHelpers from "../languages/babel-helpers";
import type { FinalAssets } from "../types";

const fs = require( "fs-extra" );
const babel = require( "@babel/core" );
const runtimePath = require.resolve( "./runtime" );

export type RuntimeArg = {
  finalAssets: FinalAssets,
  usedHelpers: Set<string>,
  minify?: ?boolean
};

export default async function( { finalAssets: { files, moduleToAssets }, usedHelpers, minify }: RuntimeArg ): Promise<string> {

  const p = await fs.readFile( runtimePath, "utf8" );

  const $buildHelpers = babelBuildHelpers( usedHelpers );

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
  input = input.replace( "$_BABEL_HELPERS", $buildHelpers );
  input = input.replace( "$_FILES", JSON.stringify( $files ) );
  input = input.replace( "$_MODULE_TO_FILES", JSON.stringify( $idToFiles ) );

  const minified = minify === undefined ? true : !!minify;

  const { code } = babel.transform( input, {
    babelrc: false,
    presets: [
      require( "@babel/preset-es2015" )
    ].concat( minified ? [ [ require( "babel-preset-minify" ), { evaluate: false } ] ] : [] ),
    comments: false,
    sourceMaps: false,
    minified
  } );

  return "\"use strict\";" + code.trim();
}
