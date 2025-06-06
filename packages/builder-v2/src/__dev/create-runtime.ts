import { Manifest, RuntimeManifest } from "../types";

const fs = require( "fs-extra" );
const path = require( "path" );

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

// https://mathiasbynens.be/notes/globalthis
// crypto.createHash("sha256").update("quase_builder").digest("ascii").slice(0,3) == "_xW"
export const chunkInit = `
"use strict";
(
  (m,f)=>{
    var o=Object,g=typeof globalThis=="object"?globalThis:(o.defineProperty(o.prototype,"_xW",{
      get(){
        delete o.prototype._xW;
        return this;
      },
      configurable:true
    }),_xW);
    (g.${KEY}=g.${KEY}||{q:[]}).q.push([m,f])
  }
)`.replace( /\n/g, "" );

const cache: { [key: string]: Promise<string> } = {};

export async function createRuntime(
  runtime: RuntimeOptions,
  { context, fullPath, publicPath, minify }: RuntimeInfo
): Promise<string> {

  const minified = minify === undefined ? !runtime.hmr : !!minify;

  const filename = [
    "runtime",
    runtime.browser && "browser",
    runtime.hmr && "hmr",
    minified && "min",
    "js"
  ].filter( Boolean ).join( "." );

  const fullFilename = path.join( __dirname, "builds", filename );

  let input = await ( cache[ filename ] || ( cache[ filename ] = fs.readFile( fullFilename, "utf8" ) ) );

  const relative = ( path.relative( path.dirname( fullPath ), context ).replace( /\\/g, "/" ) || "." ) + "/";

  if ( relative === publicPath ) {
    input = input.replace( "$_PUBLIC_PATH", JSON.stringify( relative ) );
  } else if ( runtime.node ) {
    input = input.replace( "$_PUBLIC_PATH", `nodeRequire ? ${JSON.stringify( relative )} : ${JSON.stringify( publicPath )}` );
  } else {
    input = input.replace( "$_PUBLIC_PATH", JSON.stringify( publicPath ) );
  }

  if ( runtime.hmr ) {
    input = input.replace( "$_HMR_HOSTNAME", JSON.stringify( runtime.hmr.hostname ) );
    input = input.replace( "$_HMR_PORT", runtime.hmr.port + "" );
  }

  return input.replace( "/* eslint-disable */\n", "" );
}

export function createRuntimeManifest( { files, moduleToAssets }: Manifest ): RuntimeManifest | null {

  if ( files.length === 0 ) {
    return null;
  }

  const fileToIdx: { [key: string]: number } = {};
  const $files: string[] = files.map( ( f, i ) => {
    fileToIdx[ f ] = i;
    return f;
  } );

  const $idToFiles: { [key: string]: number[] } = {};
  for ( const [ hashId, files ] of moduleToAssets ) {
    if ( files.length > 0 ) {
      $idToFiles[ hashId ] = files.map( f => fileToIdx[ f ] );
    }
  }

  return {
    f: $files,
    m: $idToFiles
  };
}
