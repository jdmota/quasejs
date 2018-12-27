import { Manifest } from "../types";
import { createRuntimeHelper } from "./runtime";
import babelPreset from "./babel-preset";

const path = require( "path" );
const babel = require( "@babel/core" );

export type RuntimeOptions = {
  hmr: {
    hostname: string;
    port: number;
  }|null;
  browser: boolean;
  node: boolean;
  worker: boolean;
};

export type RuntimeInfo = {
  context: string;
  fullPath: string;
  publicPath: string;
  minify: boolean;
};

const KEY = "__quase_builder__";

export const chunkInit = `"use strict";({g:"undefined"==typeof self?Function("return this")():self,p(m,f){(this.g.${KEY}=this.g.${KEY}||{q:[]}).q.push([m,f])}})`;

export const moduleArgs: ReadonlyArray<string> = "$e,$r,$i,$g,$a,$m".split( "," );

export async function createRuntime(
  runtime: RuntimeOptions,
  { context, fullPath, publicPath, minify }: RuntimeInfo
): Promise<string> {

  const relative = ( path.relative( path.dirname( fullPath ), context ).replace( /\\/g, "/" ) || "." ) + "/";

  let input = createRuntimeHelper( runtime );

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
      babelPreset
    // @ts-ignore
    ].concat( minified ? [
      [ require( "babel-preset-minify" ), {
        builtIns: false,
        evaluate: false
      } ]
    ] : [] ),
    comments: !minified,
    sourceMaps: false,
    ast: false,
    minified
  } );

  return code.trim();
}

export function createRuntimeManifest( { files, moduleToAssets }: Manifest ) {

  if ( moduleToAssets.size === 0 ) {
    return null;
  }

  const fileToIdx: { [key: string]: number } = {};
  const $files: string[] = files.map( ( f, i ) => {
    fileToIdx[ f.relativeDest ] = i;
    return f.relativeDest;
  } );

  const $idToFiles: { [key: string]: number[] } = {};
  for ( const [ module, files ] of moduleToAssets ) {
    $idToFiles[ module.hashId ] = files.map( f => fileToIdx[ f.relativeDest ] );
  }

  return {
    f: $files,
    m: $idToFiles
  };
}
