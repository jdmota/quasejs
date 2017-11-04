( function( global, nodeRequire ) {

  // Help reduce minified size
  const UNDEFINED = undefined;
  const NULL = null;
  const Promise = global.Promise;
  const importScripts = global.importScripts;
  const doc = global.document;

  const helpers = {};

  const isNode = nodeRequire !== UNDEFINED;
  const isWorker = importScripts !== UNDEFINED;
  const isBrowser = global.window === global;

  function blank() { return Object.create( NULL ); }

  const modules = blank();
  const fnModules = blank(); // Functions that load the module
  const fileImports = blank(); // Files that were imported already
  const fetches = blank(); // Fetches

  const idToFile = {};

  let count = 0;

  function require( id ) {
    if ( id ) {
      if ( isWorker ) {
        importScripts( id );
      } else if ( isNode ) {
        const c = count;
        const e = nodeRequire( id );
        if ( e && c === count ) {
          return e;
        }
      }
    }
    return NULL;
  }

  function push( moreModules ) {
    for ( const id in moreModules ) {
      const module = moreModules[ id ];
      if ( id === "__b__" ) {
        for ( const name in module ) {
          helpers[ name ] = module[ name ];
        }
      } else if ( id === "__i__" ) {
        for ( const name in module ) {
          idToFile[ name ] = module[ name ];
        }
      } else if ( fnModules[ id ] === UNDEFINED ) {
        fnModules[ id ] = module;
        count++;
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

  function load( id, fallback ) {

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

    if ( fallback ) { // In case we imported an external module
      modules[ id ] = fallback;
      return fallback;
    }

    throw new Error( `Module ${id} not found` );
  }

  function requireSync( id ) {
    return load( id, importFileSync( idToFile[ id ] ) );
  }

  function requireAsync( id ) {
    return importFileAsync( idToFile[ id ] ).then( fallback => load( id, fallback ) );
  }

  function importFileSync( id ) {
    if ( fileImports[ id ] === UNDEFINED ) {
      fileImports[ id ] = require( id );
    }
    return fileImports[ id ];
  }

  function importFileAsync( src ) {

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

    script.onload = done;
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