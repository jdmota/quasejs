import { RuntimeManifest, HmrUpdate, HmrMessage } from "../types";

// TO REMOVE
const $_PUBLIC_PATH = "";
const $_HMR = null;
const $_WITH_BROWSER = true;
// END TO REMOVE

/* globals self */
/* eslint no-console: 0, @typescript-eslint/camelcase: 0 */

type O<T> = { [key: string]: T };

type Exported = {
  __esModule: boolean;
  default?: unknown;
};

type HmrOpts = {
  hostname: string;
  port: number;
};

interface HotApiInterface {
  addRequiredBy( parentApi: HotApiInterface | null ): void;
  onDependencyChange( id: string, fn: Function ): void;
  onChange( fn: Function ): void;
  callDependencyChange( id: string, error: Error | null ): any;
  callChange(): any;
  notifyParents( seen: Set<HotApiInterface>, needReload: Set<HotApiInterface | null>, error: Error | null ): void;
  reset( fnReset: boolean ): void;
  load( notifyAncestors: boolean ): Promise<HmrLoad>;
  reload(): Promise<HmrLoad>;
  reloadNew(): Promise<HmrLoad>;
  delete(): void;
}

type HmrLoad = {
  api: HotApiInterface;
  error: Error | null;
  notifyAncestors: boolean;
};

type HmrOps = {
  init: () => void;
  getApi: ( id: string ) => HotApiInterface;
  requireSync: ( parent: HotApiInterface | null ) => {
    ( id: string ): Exported;
    r( id: string ): unknown;
  };
  requireAsync: ( parent: HotApiInterface | null ) => ( id: string ) => Promise<Exported>;
};

type ModuleFn = ( _: {
  e: Exported;
  r: { ( id: string ): Exported; r( id: string ): unknown };
  i: ( id: string ) => Promise<Exported>;
  g: ( e: Exported, name: string, get: () => any ) => void;
  a: ( e: Exported, o: O<any> ) => void;
  m: O<unknown>;
} ) => void;

type GlobalThis = {
  window?: Window;
  document?: Document;
  location?: Location;
  WebSocket?: {
    new( url: string ): WebSocket;
  };
  importScripts?: Function;
  __quase_builder__?: any;
};

( function( global: GlobalThis, nodeRequire: false | NodeRequire ) {

  // Help reduce minified size
  const UNDEFINED = undefined;
  const NULL = null;
  const { document, location, importScripts } = global;
  const isBrowser = $_WITH_BROWSER && global.window === global;

  const blank = () => Object.create( NULL );

  const modules = blank() as O<Exported | undefined>;
  const fnModules = blank() as O<ModuleFn | null | undefined>; // Functions that load the module
  const fileImports = blank() as O<Exported | null | undefined>; // Files that were imported already
  const fetches = blank() as O<Promise<Exported | null> | undefined>; // Fetches

  const publicPath = $_PUBLIC_PATH as string;
  const moduleToAssets = blank() as O<string[] | undefined>;

  const hmr = $_HMR as HmrOpts | null;
  const hmrOps = hmr ? makeHmr( hmr ) : null;

  function makeHmr( hmr: HmrOpts ): HmrOps {
    const { WebSocket } = global;
    const hmrApis: Map<string, HotApi> = new Map();

    const getHotApi = ( id: string ) => {
      const api = hmrApis.get( id ) || new HotApi( id );
      hmrApis.set( id, api );
      return api;
    };

    const hmrRequireSync = ( parentApi: HotApiInterface | null ) => {
      const newFn = ( id: string ) => {
        const e = requireSync( id );
        getHotApi( id ).addRequiredBy( parentApi );
        return e;
      };

      newFn.r = ( id: string ) => {
        const e = newFn( id );
        return e.__esModule === false ? e.default : e;
      };
      return newFn;
    };

    const hmrRequireAsync = ( parentApi: HotApiInterface | null ) => {
      return ( id: string ) => {
        return requireAsync( id ).then( e => {
          getHotApi( id ).addRequiredBy( parentApi );
          return e;
        } );
      };
    };

    class HotApi implements HotApiInterface {

      private id: string;
      private requiredBy: Set<HotApiInterface | null>;
      private dependencyChange: { [key: string]: Function };
      private change: Function | null;

      constructor( id: string ) {
        this.id = id;
        this.requiredBy = new Set();
        this.dependencyChange = {};
        this.change = null;
      }

      addRequiredBy( parentApi: HotApiInterface | null ) {
        this.requiredBy.add( parentApi );
      }

      onDependencyChange( id: string, fn: Function ) {
        this.dependencyChange[ id ] = fn;
      }

      onChange( fn: Function ) {
        this.change = fn;
      }

      callDependencyChange( id: string, error: Error | null ) {
        const fn = this.dependencyChange[ id ];
        return fn ? fn( id, error ) : false;
      }

      callChange() {
        const fn = this.change;
        return fn ? fn() : true;
      }

      notifyParents( seen: Set<HotApiInterface>, needReload: Set<HotApiInterface | null>, error: Error | null ) {
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

      reset( fnReset: boolean ) {
        this.dependencyChange = {};
        this.change = null;
        modules[ this.id ] = UNDEFINED;
        if ( fnReset ) {
          fnModules[ this.id ] = UNDEFINED;
        }
      }

      load( notifyAncestors: boolean ): Promise<HmrLoad> {
        return requireAsync( this.id ).then( () => ( {
          api: this,
          error: null,
          notifyAncestors
        } ), ( error: Error ) => ( {
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

    let reloadApp: any;
    let state = {
      success: true,
      reload: false
    };

    const UI_ID = "__quase_builder_ui__";
    let ui: HTMLDivElement | null = null;

    const updateUI = () => {
      if ( !document ) {
        return;
      }
      if ( !ui ) {
        ui = document.createElement( "div" );
        ui.id = UI_ID;
        document.body.appendChild( ui );
      }

      const success = state.success;
      const reload = state.reload;

      ui.innerHTML = (
        `<div style="z-index:99999;color:white;position:fixed;top:0;
          right: 50px;line-height:30px;font-family:Menlo, Consolas, monospace;">
          <div style="${reload ? "display:block;" : "display:none;"};font-size:18px;padding:10px;background:yellow;color:black;float:left;cursor:pointer;">🗘</div>
          <div style="float:left;background:${success ? "green" : "red"};padding:10px;">Build: ${success ? "Success" : "Error"}</div>
        </div>`
      );

      ui.getElementsByTagName( "div" )[ 1 ].onclick = reloadApp;
    };

    const hmrReloadApp = ( reason: string ) => {
      console.log( "[quase-builder] App reload? Reason: " + reason );
      state.reload = true;
      updateUI();
    };

    let lastHotUpdate = Promise.resolve();

    const hmrUpdate = async( hmrUpdate: HmrUpdate ) => {
      const seen: Set<HotApi> = new Set();
      let queue: Promise<HmrLoad>[] = [];
      let shouldReloadApp = false;
      let reloadCauseEntry = false;

      for ( const id in moduleToAssets ) {
        moduleToAssets[ id ] = undefined;
      }

      for ( const id in hmrUpdate.moduleToAssets ) {
        moduleToAssets[ id ] = hmrUpdate.moduleToAssets[ id ].map( f => publicPath + f );
      }

      for ( const { file, prevFile, reloadApp } of hmrUpdate.updates ) {
        if ( file ) {
          fileImports[ publicPath + file ] = UNDEFINED;
          fetches[ publicPath + file ] = UNDEFINED;
        }
        if ( prevFile ) {
          fileImports[ publicPath + prevFile ] = UNDEFINED;
          fetches[ publicPath + prevFile ] = UNDEFINED;
        }
        shouldReloadApp = shouldReloadApp || reloadApp;
      }

      reloadCauseEntry = shouldReloadApp;

      for ( const { id, file } of hmrUpdate.updates ) {
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

        const needReload: Set<HotApi> = new Set();

        for ( const job of prevQueue ) {
          const { api, error, notifyAncestors } = await job;

          if ( notifyAncestors ) {
            api.notifyParents( seen, needReload, error );
          }

          if ( error ) {
            console.error( error );
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
    };

    const OVERLAY_ID = "__quase_builder_error_overlay__";
    let overlay: HTMLDivElement | null = null;

    const removeErrorOverlay = () => {
      if ( overlay ) {
        overlay.remove();
        overlay = null;
      }
    };

    // Adapted from https://github.com/parcel-bundler/parcel
    const createErrorOverlay = ( error: string ) => {
      if ( !document ) {
        return;
      }
      if ( !overlay ) {
        overlay = document.createElement( "div" );
        overlay.id = OVERLAY_ID;
        document.body.appendChild( overlay );
      }

      // Html encode
      const errorText = document.createElement( "pre" );
      errorText.innerText = error;

      overlay.innerHTML = (
        `<div style="background:black;font-size:16px;color:white;position:fixed;height:100%;width:100%;top:0px;left:0px;padding:30px;opacity:0.85; font-family:Menlo,Consolas,monospace;z-index: 9999;">
          <span style="background:red;padding:2px 4px;border-radius:2px;">ERROR</span>
          <span style="margin-left:10px;font-size:18px;position:relative;cursor:pointer;">🗙</span>
          <pre style="margin-top:20px;">${errorText.innerHTML}</pre>
        </div>`
      );

      overlay.getElementsByTagName( "span" )[ 1 ].onclick = removeErrorOverlay;
    };

    const hmrInit = () => {
      if ( !location || !WebSocket ) {
        return;
      }
      const protocol = location.protocol === "https:" ? "wss" : "ws";
      const ws = new WebSocket( protocol + "://" + hmr.hostname + ":" + hmr.port + "/" );
      ws.onmessage = event => {
        const data = JSON.parse( event.data ) as HmrMessage;

        switch ( data.type ) {
          case "update":
            lastHotUpdate = lastHotUpdate.then( () => {
              console.log( "[quase-builder] ✨", data.update );
              state.success = true;
              updateUI();
              removeErrorOverlay();
              return hmrUpdate( data.update );
            } );
            break;
          case "error":
            console.error( "[quase-builder] 🚨", data.error );
            state.success = false;
            updateUI();
            createErrorOverlay( data.error );
            break;
          default:
        }
      };
      ws.onerror = event => {
        console.error( "[quase-builder] socket error", event );
      };
      ws.onopen = () => {
        console.log( "[quase-builder] HMR connection open on port " + hmr.port );
      };

      reloadApp = () => {
        if ( ws.readyState === 3 ) {
          location.reload();
        } else {
          ws.close();
          ws.onclose = () => {
            location.reload();
          };
        }
      };
    };

    return {
      init: hmrInit,
      getApi: getHotApi,
      requireSync: hmrRequireSync,
      requireAsync: hmrRequireAsync
    };
  }

  function require( id: string ) {
    if ( id ) {
      if ( importScripts ) {
        importScripts( id );
      } else if ( nodeRequire ) {
        nodeRequire( id );
      }
    }
    return NULL;
  }

  function pushInfo( moreInfo: RuntimeManifest ) {
    const files = moreInfo.f;
    const mToFiles = moreInfo.m;
    for ( const id in mToFiles ) {
      moduleToAssets[ id ] = mToFiles[ id ].map( f => publicPath + files[ f ] );
    }
  }

  function pushModules( moreModules: O<ModuleFn> ) {
    for ( const id in moreModules ) {
      if ( fnModules[ id ] === UNDEFINED ) {
        fnModules[ id ] = moreModules[ id ];
      }
    }
  }

  function push( arg: [ O<ModuleFn>, RuntimeManifest | undefined ] ) {
    if ( arg[ 1 ] ) pushInfo( arg[ 1 ] );
    pushModules( arg[ 0 ] );
  }

  function exportHelper( e: Exported, name: string, get: () => any ) {
    Object.defineProperty( e, name, { enumerable: true, get } );
  }

  function exportAllHelper( e: Exported, o: O<any> ) {
    Object.keys( o ).forEach( k => {
      if ( k === "default" || k === "__esModule" ) return;
      Object.defineProperty( e, k, {
        configurable: true,
        enumerable: true,
        get: () => o[ k ]
      } );
    } );
  }

  function exists( id: string ) {
    return !!( modules[ id ] || fnModules[ id ] );
  }

  const load = ( id: string ): Exported => {

    const curr = modules[ id ];
    if ( curr ) {
      return curr;
    }

    const fn = fnModules[ id ];
    if ( !hmr ) {
      fnModules[ id ] = NULL;
    }

    if ( fn ) {
      const moduleExports: Exported = { __esModule: true };

      modules[ id ] = moduleExports;

      if ( hmrOps ) {
        const api = hmrOps.getApi( id );

        fn( {
          e: moduleExports,
          r: hmrOps.requireSync( api ),
          i: hmrOps.requireAsync( api ),
          g: exportHelper,
          a: exportAllHelper,
          m: { hot: api }
        } );
      } else {
        fn( {
          e: moduleExports,
          r: requireSync,
          i: requireAsync,
          g: exportHelper,
          a: exportAllHelper,
          m: {}
        } );
      }

      return moduleExports;
    }

    const err = new Error( `Cannot find module ${id}` ) as Error & { code: string };
    err.code = "MODULE_NOT_FOUND";
    throw err;
  };

  function requireSync( id: string ) {
    if ( !exists( id ) ) {
      ( moduleToAssets[ id ] || [] ).forEach( importFileSync );
    }
    return load( id );
  }

  requireSync.r = ( id: string ) => {
    const e = requireSync( id );
    return e.__esModule === false ? e.default : e;
  };

  function requireAsync( id: string ) {
    return Promise.all(
      exists( id ) ? [] : ( moduleToAssets[ id ] || [] ).map( importFileAsync )
    ).then( () => load( id ) );
  }

  function importFileSync( file: string ) {
    if ( fileImports[ file ] === UNDEFINED ) {
      fileImports[ file ] = require( file );
    }
    return fileImports[ file ];
  }

  function importFileAsync( src: string ) {
    if ( fileImports[ src ] !== UNDEFINED ) {
      return Promise.resolve( fileImports[ src ] );
    }

    if ( fetches[ src ] ) {
      return fetches[ src ];
    }

    let resolve: ( exported: Exported | null ) => void;
    let reject: ( err: Error ) => void;

    const promise = new Promise<Exported | null>( ( a, b ) => {
      resolve = a;
      reject = b;
    } );

    const resolution: [ typeof resolve, typeof reject ] = [
      ( exported: Exported | null ) => {
        fetches[ src ] = UNDEFINED;
        resolve( fileImports[ src ] = exported );
      },
      ( err: Error ) => {
        fetches[ src ] = UNDEFINED;
        reject( err );
      }
    ];

    fetches[ src ] = promise;

    if ( isBrowser && document ) {
      const script = document.createElement( "script" );
      script.type = "text/javascript";
      script.charset = "utf-8";
      script.async = true;
      script.src = src;

      let timeout: any;

      const done = ( err?: Error ) => {
        clearTimeout( timeout );
        // @ts-ignore
        script.onerror = script.onload = NULL; // Avoid memory leaks in IE
        if ( err ) {
          resolution[ 1 ]( err );
        } else {
          resolution[ 0 ]( NULL );
        }
      };

      const onError = () => {
        done( new Error( `Fetching ${src} failed` ) );
      };

      timeout = setTimeout( onError, 120000 );

      script.onload = () => { done(); };
      script.onerror = onError;

      document.head.appendChild( script );
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
      me.r = hmrOps ? hmrOps.requireSync( null ) : requireSync;
      me.i = hmrOps ? hmrOps.requireAsync( null ) : requireAsync;
      me.q = { push };
      if ( hmrOps ) {
        hmrOps.init();
      }
    }
  } else {
    me = global.__quase_builder__ = {
      r: hmrOps ? hmrOps.requireSync( null ) : requireSync,
      i: hmrOps ? hmrOps.requireAsync( null ) : requireAsync,
      q: { push }
    };
    if ( hmrOps ) {
      hmrOps.init();
    }
  }

  return me.r;
} )(
  // eslint-disable-next-line no-new-func
  typeof self !== "undefined" ? self : Function( "return this" )(), typeof require !== "undefined" && require
);
