( function( global, nodeRequire ) {

  // Help reduce minified size
  const UNDEFINED = undefined;
  const NULL = null;
  const Promise = global.Promise;
  const importScripts = global.importScripts;
  const doc = global.document;
  const resolved = Promise.resolve();

  const helpers = { __BABEL_HELPERS__: 1 }; // This will be replaced

  const isNode = nodeRequire !== UNDEFINED;
  const isWorker = importScripts !== UNDEFINED;
  const isBrowser = global.window === global;

  function blank() { return Object.create( NULL ); }

  const modules = blank();
  const fnModules = blank();
  const externalModules = blank();
  const fileImports = blank();
  const fetches = blank();

  const idToFile = { __ID_TO_FILE_HERE__: 1 }; // This will be replaced
  const idToGlobal = { __ID_TO_GLOBAL_HERE__: 1 }; // This will be replaced

  function add( moreModules ) {
    for ( const id in moreModules ) {
      if ( fnModules[ id ] === UNDEFINED ) {
        fnModules[ id ] = moreModules[ id ];
      }
    }
  }

  function saveExternal( id, obj ) {
    const e = isNode ? obj : global[ idToGlobal[ id ] ];
    return ( externalModules[ id ] = e && e.__esModule ? e : { default: e } );
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

    throw new Error( `Module ${id} not found` );
  }

  function requireExternalSync( id ) {
    if ( externalModules[ id ] ) {
      return externalModules[ id ];
    }
    return saveExternal( id, importFile( id ) );
  }

  function requireSync( id ) {
    if ( fnModules[ id ] === UNDEFINED ) {
      importFile( idToFile[ id ] );
    }
    return load( id );
  }

  function importFile( id ) {
    if ( fileImports[ id ] === UNDEFINED ) {
      if ( isNode ) {
        fileImports[ id ] = nodeRequire( id );
      } else if ( isWorker ) {
        importScripts( id );
        fileImports[ id ] = NULL;
      }
    }
    return fileImports[ id ];
  }

  function requireExternalAsync( id ) {
    if ( externalModules[ id ] ) {
      return Promise.resolve( externalModules[ id ] );
    }
    return importFileAsync( id ).then( e => saveExternal( id, e ) );
  }

  function requireAsync( id ) {
    if ( fnModules[ id ] === UNDEFINED ) {
      return importFileAsync( idToFile[ id ] ).then( () => load( id ) );
    }
    return resolved.then( () => load( id ) );
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
        resolve( fileImports[ src ] = isNode ? e : NULL );
      };
      resolution[ 1 ] = err => {
        fetches[ src ] = UNDEFINED;
        reject( err );
      };
    } );

    fetches[ src ] = promise;

    if ( !isBrowser ) {
      resolved.then( () => ( isNode ? nodeRequire( src ) : importScripts( src ) ) ).then( resolution[ 0 ], resolution[ 1 ] );
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
      resolution[ err ? 1 : 0 ]( err );
    }

    function onError() {
      done( new Error( `Fetching ${src} failed` ) );
    }

    script.onload = done;
    script.onerror = onError;

    doc.head.appendChild( script );

    return promise;
  }

  requireSync.e = requireExternalSync;
  requireSync.i = requireExternalAsync;

  global.__quase_builder__ = { r: requireSync, a: add };

} )( typeof self !== "undefined" ? self : Function( "return this" )(), typeof require !== "undefined" && require ); // eslint-disable-line
