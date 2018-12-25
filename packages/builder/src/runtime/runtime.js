// @flow
import type { RuntimeOptions } from "./create-runtime";

function createHotRuntime( hmr ) {
  return `
  const hmrApis = new Map();

  function getHotApi( id ) {
    const api = hmrApis.get( id ) || new HotApi( id );
    hmrApis.set( id, api );
    return api;
  }

  class HotApi {

    constructor( id ) {
      this.id = id;
      this.requiredBy = new Set();
      this.dependencyChange = {};
      this.change = null;
    }

    onDependencyChange( id, fn ) {
      this.dependencyChange[ id ] = fn;
    }

    onChange( fn ) {
      this.change = fn;
    }

    callDependencyChange( id, error ) {
      const fn = this.dependencyChange[ id ];
      return fn ? fn( id, error ) : false;
    }

    callChange() {
      const fn = this.change;
      return fn ? fn() : false;
    }

    notifyParents( seen, needReload, error ) {
      const requiredBy = this.requiredBy;
      this.requiredBy = new Set();

      for ( const ancestor of requiredBy ) {
        if ( ancestor ) {
          if ( !seen.has( ancestor ) ) {
            if ( ancestor.callDependencyChange( this.id, error ) ) {
              needReload.add( ancestor );
            } else {
              this.requiredBy.add( ancestor );
            }
          }
        } else {
          needReload.add( null );
        }
      }
    }

    reset( fnReset ) {
      this.dependencyChange = {};
      this.change = null;
      modules[ this.id ] = UNDEFINED;
      if ( fnReset ) {
        fnModules[ this.id ] = UNDEFINED;
      }
    }

    load( notifyAncestors ) {
      return requireAsync( this.id ).catch( err => err ).then( error => ( {
        api: this,
        error,
        notifyAncestors
      } ) );
    }

    reload() {
      const notifyAncestors = this.callChange();
      this.reset( false );
      return this.load( notifyAncestors );
    }

    reloadNew() {
      const notifyAncestors = this.callChange();
      this.reset( true );
      return this.load( notifyAncestors );
    }

    delete() {
      // Module no longer exists.
      // Modules that depend on this will get reloaded later.
      this.callChange();

      this.reset( true );
      this.requiredBy.clear();
      hmrApis.delete( this.id );
    }

  }

  let lastHotUpdate = Promise.resolve();

  async function hmrUpdate( updates ) {
    const seen = new Set();
    let queue = [];
    let shouldReloadApp = false;
    let reloadCauseEntry = false;

    for ( const { id, file, prevFile, reloadApp, requiredAssets } of updates ) {
      if ( file ) {
        fileImports[ publicPath + file ] = UNDEFINED;
        fetches[ publicPath + file ] = UNDEFINED;
        moduleToFiles[ id ] = requiredAssets.map( f => publicPath + f );
      }
      if ( prevFile ) {
        fileImports[ publicPath + prevFile ] = UNDEFINED;
        fetches[ publicPath + prevFile ] = UNDEFINED;
      }
      shouldReloadApp = shouldReloadApp || reloadApp;
    }

    reloadCauseEntry = shouldReloadApp;

    for ( const { id, file } of updates ) {
      const api = hmrApis.get( id );
      if ( api ) {
        seen.add( api );
        if ( file ) {
          queue.push( api.reloadNew() );
        } else {
          api.delete();
        }
      }
    }

    while ( queue.length > 0 ) {
      const prevQueue = queue;
      queue = [];

      const needReload = new Set();

      for ( const job of prevQueue ) {
        const { api, error, notifyAncestors } = await job;

        if ( notifyAncestors ) {
          api.notifyParents( seen, needReload, error );
        }
      }

      for ( const api of needReload ) {
        if ( api ) {
          seen.add( api );
          queue.push( api.reload() );
        } else {
          shouldReloadApp = true;
        }
      }
    }

    if ( shouldReloadApp ) {
      hmrReloadApp(
        reloadCauseEntry ? "Entry changed" : "Immediate entry dependency requested reload"
      );
    }
  }

  let reloadApp;
  let state = {
    success: true,
    reload: false
  };

  function hmrReloadApp( reason ) {
    console.log( "[quase-builder] App reload? Reason: " + reason );
    state.reload = true;
    updateUI();
  }

  const UI_ID = "__quase_builder_ui__";
  let ui = null;

  function updateUI() {
    if ( !ui ) {
      ui = document.createElement( "div" );
      ui.id = UI_ID;
      document.body.appendChild( ui );
    }

    const success = state.success;
    const reload = state.reload;

    ui.innerHTML = (
      '<div style="z-index:99999;color:white;position:fixed;top:0;' +
        'right: 50px;line-height:30px;font-family: Menlo, Consolas, monospace;">' +
        '<div style="font-size:18px;padding:10px;background:yellow;color:black;float:left;cursor:pointer;' + ( reload ? 'display:block;' : 'display:none;' ) + '">🗘</div>' +
        '<div style="float:left;background:' + ( success ? 'green' : 'red' ) + ';padding:10px;">Build: ' + ( success ? 'Success' : 'Error' ) + '</div>' +
      '</div>'
    );

    ui.getElementsByTagName( "div" )[ 1 ].onclick = reloadApp;
  }

  const OVERLAY_ID = "__quase_builder_error_overlay__";
  let overlay = null;

  // Adapted from https://github.com/parcel-bundler/parcel
  function createErrorOverlay( error ) {
    if ( !overlay ) {
      overlay = document.createElement( "div" );
      overlay.id = OVERLAY_ID;
      document.body.appendChild( overlay );
    }

    // Html encode
    const errorText = document.createElement( "pre" );
    errorText.innerText = error;

    overlay.innerHTML = (
      '<div style="background: black; font-size: 16px; color: white; position: fixed; height: 100%; width: 100%; top: 0px; left: 0px; padding: 30px; opacity: 0.85; font-family: Menlo, Consolas, monospace; z-index: 9999;">' +
        '<span style="background: red; padding: 2px 4px; border-radius: 2px;">ERROR</span>' +
        '<span style="margin-left: 10px; font-size: 18px; position: relative; cursor: pointer;">🗙</span>' +
        '<pre style="margin-top: 20px;">' + errorText.innerHTML + '</pre>' +
      '</div>'
    );

    overlay.getElementsByTagName( "span" )[ 1 ].onclick = removeErrorOverlay;
  }

  function removeErrorOverlay() {
    if ( overlay ) {
      overlay.remove();
      overlay = null;
    }
  }

  function hmrInit() {
    const protocol = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket( protocol + "://" + ${JSON.stringify( hmr.hostname )} + ":" + ${JSON.stringify( hmr.port )} + "/" );
    ws.onmessage = function( event ) {
      const data = JSON.parse( event.data );

      switch ( data.type ) {
        case "update":
          lastHotUpdate = lastHotUpdate.then( () => {
            console.log( "[quase-builder] ✨", data.updates );
            state.success = true;
            updateUI();
            removeErrorOverlay();
            return hmrUpdate( data.updates );
          } );
          break;
        case "error":
          console.error( "[quase-builder] 🚨", data.error );
          state.success = false;
          updateUI();
          createErrorOverlay( data.error );
          break;
      }
    };
    ws.onerror = function( event ) {
      console.error( "[quase-builder] socket error", event );
    };
    ws.onopen = function() {
      console.log( "[quase-builder] HMR connection open on port " + ${JSON.stringify( hmr.port )} );
    };

    reloadApp = function() {
      if ( ws.readyState === 3 ) {
        location.reload();
      } else {
        ws.close();
        ws.onclose = function() {
          location.reload();
        };
      }
    };
  }

  function hmrRequireSync( parentApi ) {
    const newFn = id => {
      const e = requireSync( id );
      getHotApi( id ).requiredBy.add( parentApi );
      return e;
    };

    newFn.r = id => {
      const e = newFn( id );
      return e.__esModule === false ? e.default : e;
    };
    return newFn;
  }

  function hmrRequireAsync( parentApi ) {
    return id => {
      return requireAsync( id ).then( e => {
        getHotApi( id ).requiredBy.add( parentApi );
        return e;
      } );
    };
  }
  `;
}

export function createRuntimeHelper( { hmr, browser, node, worker }: RuntimeOptions ) {
  return `( function( global ${node ? `, nodeRequire` : ""} ) {

    // Help reduce minified size
    const UNDEFINED = undefined;
    const NULL = null;
    const Promise = global.Promise;
    ${worker ? `const importScripts = global.importScripts;` : ""}
    ${browser ? `const doc = global.document;` : ""}

    ${node ? `const isNode = !!nodeRequire;` : ""}
    ${worker ? `const isWorker = !!importScripts;` : ""}
    ${browser ? `const isBrowser = global.window === global;` : ""}

    function blank() { return Object.create( NULL ); }

    const modules = blank();
    const fnModules = blank(); // Functions that load the module
    const fileImports = blank(); // Files that were imported already
    const fetches = blank(); // Fetches

    const publicPath = $_PUBLIC_PATH;
    const moduleToFiles = blank();

    ${hmr ? createHotRuntime( hmr ) : ""}

    function require( id ) {
      if ( id ) {
        if ( ${node ? "isWorker" : "false"} ) {
          importScripts( id );
        } else if ( ${node ? "isNode" : "false"} ) {
          nodeRequire( id );
        }
      }
      return NULL;
    }

    function pushInfo( moreInfo ) {
      const files = moreInfo.f;
      const mToFiles = moreInfo.m;
      for ( const id in mToFiles ) {
        moduleToFiles[ id ] = mToFiles[ id ].map( f => publicPath + files[ f ] );
      }
    }

    function pushModules( moreModules ) {
      for ( const id in moreModules ) {
        if ( fnModules[ id ] === UNDEFINED ) {
          fnModules[ id ] = moreModules[ id ];
        }
      }
    }

    function push( arg ) {
      if ( arg[ 1 ] ) pushInfo( arg[ 1 ] );
      pushModules( arg[ 0 ] );
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
      ${hmr ? "" : `fnModules[ id ] = NULL;`}

      if ( fn ) {
        const moduleExports = {};

        Object.defineProperty( moduleExports, "__esModule", {
          writable: true,
          value: true
        } );

        modules[ id ] = moduleExports;

        ${hmr ? `const api = getHotApi( id );` : ""}

        // $e, $r, $i, $g, $a
        fn(
          moduleExports,
          ${hmr ? `hmrRequireSync( api )` : `requireSync`},
          ${hmr ? `hmrRequireAsync( api )` : `requireAsync`},
          exportHelper,
          exportAllHelper,
          ${hmr ? `{ hot: api }` : "{}"}
        );

        return moduleExports;
      }

      const err = new Error( \`Cannot find module \${id}\` );
      err.code = "MODULE_NOT_FOUND";
      throw err;
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

    function importFileSync( file ) {
      if ( fileImports[ file ] === UNDEFINED ) {
        fileImports[ file ] = require( file );
      }
      return fileImports[ file ];
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

      if ( ${browser ? ( node || worker ? "isBrowser" : "true" ) : "false"} ) {
        const script = doc.createElement( "script" );
        script.type = "text/javascript";
        script.charset = "utf-8";
        script.async = true;
        script.timeout = 120000;
        script.src = src;

        const timeout = setTimeout( onError, 120000 );

        const done = err => {
          clearTimeout( timeout );
          script.onerror = script.onload = UNDEFINED; // Avoid memory leaks in IE
          resolution[ err ? 1 : 0 ]( err || NULL );
        };

        const onError = () => {
          done( new Error( \`Fetching \${src} failed\` ) );
        };

        script.onload = () => { done(); };
        script.onerror = onError;

        doc.head.appendChild( script );
      } else {
        Promise.resolve( src ).then( require ).then( resolution[ 0 ], resolution[ 1 ] );
      }

      return promise;
    }

    let me = global.__quase_builder__;

    if ( me ) {
      if ( Array.isArray( me.q ) ) {
        for ( let i = 0; i < me.q.length; i++ ) {
          push( me.q[ i ] );
        }
        me.r = ${hmr ? `hmrRequireSync( null )` : `requireSync`};
        me.i = ${hmr ? `hmrRequireAsync( null )` : `requireAsync`};
        me.q = { push };
        ${hmr ? `hmrInit();` : ""}
      }
    } else {
      me = global.__quase_builder__ = {
        r: ${hmr ? `hmrRequireSync( null )` : `requireSync`},
        i: ${hmr ? `hmrRequireAsync( null )` : `requireAsync`},
        q: { push }
      };
      ${hmr ? `hmrInit();` : ""}
    }

    return me.r;
  } )(
    typeof self !== "undefined" ? self : Function( "return this" )()
    ${node ? `, typeof require !== "undefined" && require` : ""}
  );`;
}
