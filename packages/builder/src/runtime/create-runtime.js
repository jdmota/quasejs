// @flow
import type { FinalAssets } from "../types";

const path = require( "path" );
const babel = require( "@babel/core" );

export type RuntimeArg = {
  context: string,
  fullPath: string,
  publicPath: string,
  finalAssets: FinalAssets,
  runtime: {
    browser: boolean,
    node: boolean,
    worker: boolean
  },
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

const RUNTIME = `( function( global, nodeRequire ) {

  // Help reduce minified size
  const UNDEFINED = undefined;
  const NULL = null;
  const Promise = global.Promise;
  $_IMPORT_SCRIPTS;
  $_DOC;

  $_IS_NODE;
  $_IS_WORKER;
  $_IS_BROWSER;

  function blank() { return Object.create( NULL ); }

  const modules = blank();
  const fnModules = blank(); // Functions that load the module
  const fileImports = blank(); // Files that were imported already
  const fetches = blank(); // Fetches

  const publicPath = $_PUBLIC_PATH;
  const files = $_FILES;
  const moduleToFiles = $_MODULE_TO_FILES;

  function require( id ) {
    if ( id ) {
      if ( isWorker ) {
        importScripts( id );
      } else if ( isNode ) {
        nodeRequire( id );
      }
    }
    return NULL;
  }

  function push( moreModules ) {
    for ( const id in moreModules ) {
      if ( fnModules[ id ] === UNDEFINED ) {
        fnModules[ id ] = moreModules[ id ];
      }
    }
  }

  function exportHelper( e, name, get ) {
    Object.defineProperty( e, name, { enumerable: true, get } );
  }

  function exportAllHelper( e, o ) {
    Object.keys( o ).forEach( k => {
      if ( k === "default" || k === "__esModule" ) return;
      Object.defineProperty( e, k, {
        configurable: true,
        enumerable: true,
        get: () => o[ k ]
      } );
    } );
  }

  function exists( id ) {
    return modules[ id ] || fnModules[ id ];
  }

  function load( id ) {

    if ( modules[ id ] ) {
      return modules[ id ];
    }

    const fn = fnModules[ id ];
    fnModules[ id ] = NULL;

    if ( fn ) {
      const moduleExports = {};

      Object.defineProperty( moduleExports, "__esModule", {
        writable: true,
        value: true
      } );

      modules[ id ] = moduleExports;

      // $e, $r, $i, $g, $a
      fn( moduleExports, requireSync, requireAsync, exportHelper, exportAllHelper );

      return moduleExports;
    }

    throw new Error( \`Module \${id} not found\` );
  }

  function requireSync( id ) {
    if ( !exists( id ) ) {
      ( moduleToFiles[ id ] || [] ).forEach( importFileSync );
    }
    return load( id );
  }

  requireSync.r = function( id ) {
    const e = requireSync( id );
    return e.__esModule === false ? e.default : e;
  };

  function requireAsync( id ) {
    return Promise.all(
      exists( id ) ? [] : ( moduleToFiles[ id ] || [] ).map( importFileAsync )
    ).then( () => load( id ) );
  }

  function importFileSync( idx ) {
    const id = files[ idx ];
    if ( fileImports[ id ] === UNDEFINED ) {
      fileImports[ id ] = require( id );
    }
    return fileImports[ id ];
  }

  function importFileAsync( idx ) {
    const src = files[ idx ];

    if ( fileImports[ src ] !== UNDEFINED ) {
      return Promise.resolve( fileImports[ src ] );
    }

    if ( fetches[ src ] ) {
      return fetches[ src ];
    }

    const resolution = [ UNDEFINED, UNDEFINED ];

    const promise = new Promise( ( resolve, reject ) => {
      resolution[ 0 ] = e => {
        fetches[ src ] = UNDEFINED;
        resolve( fileImports[ src ] = e );
      };
      resolution[ 1 ] = err => {
        fetches[ src ] = UNDEFINED;
        reject( err );
      };
    } );

    fetches[ src ] = promise;

    if ( isBrowser ) {
      const script = doc.createElement( "script" );
      script.type = "text/javascript";
      script.charset = "utf-8";
      script.async = true;
      script.timeout = 120000;
      script.src = src;

      const timeout = setTimeout( onError, 120000 );

      function done( err ) {
        clearTimeout( timeout );
        script.onerror = script.onload = UNDEFINED; // Avoid memory leaks in IE
        resolution[ err ? 1 : 0 ]( err || NULL );
      }

      function onError() {
        done( new Error( \`Fetching \${src} failed\` ) );
      }

      script.onload = function() { done(); };
      script.onerror = onError;

      doc.head.appendChild( script );
    } else {
      Promise.resolve( src ).then( require ).then( resolution[ 0 ], resolution[ 1 ] );
    }

    return promise;
  }

  const me = global.__quase_builder__;

  if ( me ) {
    if ( Array.isArray( me.q ) ) {
      for ( let i = 0; i < me.q.length; i++ ) {
        push( me.q[ i ] );
      }
      me.r = requireSync;
      me.i = requireAsync;
      me.q = { push };
    }
    return me.r;
  }

  global.__quase_builder__ = { r: requireSync, i: requireAsync, q: { push } };
  return requireSync;

} )( typeof self !== "undefined" ? self : Function( "return this" )(), typeof require !== "undefined" && require );`;

export default async function( { context, fullPath, publicPath, runtime, finalAssets: { files, moduleToAssets }, minify }: RuntimeArg ): Promise<string> {

  const relative = ( path.relative( path.dirname( fullPath ), context ).replace( /\\/g, "/" ) || "." ) + "/";

  const fileToIdx = {};
  const $files = files.map( ( f, i ) => {
    fileToIdx[ f.relative ] = i;
    return f.relative;
  } );

  const $idToFiles = {};
  for ( const [ module, files ] of moduleToAssets ) {
    $idToFiles[ module.hashId ] = files.map( f => fileToIdx[ f.relative ] );
  }

  let input = RUNTIME;
  input = input.replace( "$_FILES", `${JSON.stringify( $files )}.map( p => publicPath + p )` );
  input = input.replace( "$_MODULE_TO_FILES", JSON.stringify( $idToFiles ) );

  if ( relative === publicPath ) {
    input = input.replace( "$_PUBLIC_PATH", JSON.stringify( relative ) );
  } else {
    input = input.replace( "$_PUBLIC_PATH", `isNode ? ${JSON.stringify( relative )} : ${JSON.stringify( publicPath )}` );
  }

  if ( runtime.browser ) {
    if ( !runtime.node && !runtime.worker ) {
      input = input.replace( /isBrowser/g, "true" );
    }
  } else {
    input = input.replace( /isBrowser/g, "false" );
  }

  if ( !runtime.node ) {
    input = input.replace( /isNode/g, "false" );
  }

  if ( !runtime.worker ) {
    input = input.replace( /isWorker/g, "false" );
  }

  input = input.replace( "$_DOC", runtime.browser ? "const doc = global.document" : "" );
  input = input.replace( "$_IMPORT_SCRIPTS", runtime.worker ? "const importScripts = global.importScripts" : "" );

  input = input.replace( "$_IS_BROWSER", runtime.browser ? "const isBrowser = global.window === global" : "" );
  input = input.replace( "$_IS_NODE", runtime.node ? "const isNode = !!nodeRequire" : "" );
  input = input.replace( "$_IS_WORKER", runtime.worker ? "const isWorker = !!importScripts" : "" );

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
