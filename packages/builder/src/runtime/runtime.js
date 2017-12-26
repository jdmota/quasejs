( function( global, nodeRequire ) {

  // Help reduce minified size
  const UNDEFINED = undefined;
  const NULL = null;
  const Promise = global.Promise;
  const importScripts = global.importScripts;
  const doc = global.document;

  const isNode = !!nodeRequire;
  const isWorker = !!importScripts;
  const isBrowser = global.window === global;

  function blank() { return Object.create( NULL ); }

  const modules = blank();
  const fnModules = blank(); // Functions that load the module
  const fileImports = blank(); // Files that were imported already
  const fetches = blank(); // Fetches

  /* eslint-disable no-undef, no-unused-vars */
  const publicPath = $_PUBLIC_PATH;
  const helpers = $_BABEL_HELPERS;
  const files = $_FILES;
  const moduleToFiles = $_MODULE_TO_FILES;
  /* eslint-enable no-undef, no-unused-vars */

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
        value: true
      } );

      modules[ id ] = moduleExports;

      // $e, $r, $i, $b, $g, $a
      fn( moduleExports, requireSync, requireAsync, helpers, exportHelper, exportAllHelper );

      return moduleExports;
    }

    // TODO deal with externals

    throw new Error( `Module ${id} not found` );
  }

  function requireSync( id ) {
    if ( !exists( id ) ) {
      moduleToFiles[ id ].forEach( importFileSync );
    }
    return load( id );
  }

  function requireAsync( id ) {
    return Promise.all(
      exists( id ) ? [] : moduleToFiles[ id ].map( importFileAsync )
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

    if ( !isBrowser ) {
      Promise.resolve( src ).then( require ).then( resolution[ 0 ], resolution[ 1 ] );
      return promise;
    }

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
      done( new Error( `Fetching ${src} failed` ) );
    }

    script.onload = function() { done(); };
    script.onerror = onError;

    doc.head.appendChild( script );

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
    return;
  }

  global.__quase_builder__ = { r: requireSync, i: requireAsync, q: { push } };

} )( typeof self !== "undefined" ? self : Function( "return this" )(), typeof require !== "undefined" && require ); // eslint-disable-line
