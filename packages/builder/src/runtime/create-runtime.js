// @flow
import type { FinalAssets } from "../types";
import { createRuntimeHelper } from "./runtime";

const path = require( "path" );
const babel = require( "@babel/core" );

export type RuntimeOptions = {
  hmr: ?{
    hostname: string,
    port: number
  },
  browser: boolean,
  node: boolean,
  worker: boolean
};

export type RuntimeInfo = {
  context: string,
  fullPath: string,
  publicPath: string,
  finalAssets: FinalAssets,
  minify?: ?boolean
};

const KEY = "__quase_builder__";

export const chunkInit = `"use strict";({g:"undefined"==typeof self?Function("return this")():self,p(m){(this.g.${KEY}=this.g.${KEY}||{q:[]}).q.push(m)}})`;

export const moduleArgs: $ReadOnlyArray<string> = "$e,$r,$i,$g,$a,$m".split( "," );

export async function createRuntime(
  runtime: RuntimeOptions,
  { context, fullPath, publicPath, minify, finalAssets }: RuntimeInfo
): Promise<string> {

  const relative = ( path.relative( path.dirname( fullPath ), context ).replace( /\\/g, "/" ) || "." ) + "/";
  const { files, moduleToFiles } = createRuntimeManifest( finalAssets );

  let input = createRuntimeHelper( runtime );

  input = input.replace( "$_FILES", `${JSON.stringify( files )}.map( p => publicPath + p )` );
  input = input.replace( "$_MODULE_TO_FILES", JSON.stringify( moduleToFiles ) );

  if ( relative === publicPath ) {
    input = input.replace( "$_PUBLIC_PATH", JSON.stringify( relative ) );
  } else if ( runtime.node ) {
    input = input.replace( "$_PUBLIC_PATH", `isNode ? ${JSON.stringify( relative )} : ${JSON.stringify( publicPath )}` );
  } else {
    input = input.replace( "$_PUBLIC_PATH", JSON.stringify( publicPath ) );
  }

  const minified = minify === undefined ? !runtime.hmr : !!minify;

  const { code } = await babel.transformAsync( input, {
    babelrc: false,
    configFile: false,
    sourceType: "module",
    presets: [
      require( "./babel-preset" ).default
    ].concat( minified ? [ [ require( "babel-preset-minify" ), { evaluate: false } ] ] : [] ),
    comments: !minified,
    sourceMaps: false,
    ast: false,
    minified
  } );

  return code.trim();
}

export function createRuntimeManifest( { files, moduleToAssets }: FinalAssets ) {

  const fileToIdx = {};
  const $files = files.map( ( f, i ) => {
    fileToIdx[ f.relativeDest ] = i;
    return f.relativeDest;
  } );

  const $idToFiles = {};
  for ( const [ module, files ] of moduleToAssets ) {
    $idToFiles[ module.hashId ] = files.map( f => fileToIdx[ f.relativeDest ] );
  }

  return {
    files: $files,
    moduleToFiles: $idToFiles
  };
}
