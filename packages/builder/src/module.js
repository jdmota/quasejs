// @flow
import error from "./utils/error";
import { hashName } from "./utils/hash";
import type Builder from "./builder";
import Language, { type ILanguage } from "./language";
import type {
  LoaderOutput, Data, Loc, ImportedName, ExportedName,
  Dep, NotResolvedDep,
} from "./types";
import { relative, resolvePath } from "./id";
import { Checker } from "./checker";

const { isAbsolute } = require( "path" );

function isObject( obj ) {
  return obj != null && typeof obj === "object";
}

export type ModuleArg = {
  path: string,
  isEntry?: ?boolean,
  loadResult?: ?LoaderOutput,
  builder: Builder
};

// Note: don't save references for other modules in a module. That can break incremental builds.

export default class Module {

  +path: string;
  +normalized: string;
  +dest: string;
  +id: string;
  +hashId: string;
  +isEntry: boolean;
  +loadResult: ?LoaderOutput;
  +checker: Checker;
  lang: ?ILanguage;
  type: string;
  data: Data;
  originalData: Data;
  ast: ?Object;
  maps: Object[];
  deps: Dep[];
  moduleDeps: ( Dep & { requiredId: string } )[];
  importedNames: ImportedName[];
  exportedNames: ExportedName[];
  transforming: ?Promise<Language>;
  resolving: ?Promise<void>;

  constructor( { path, isEntry, loadResult, builder }: ModuleArg ) {
    this.path = path;
    this.normalized = relative( path, builder.context );
    this.dest = resolvePath( this.normalized, builder.dest );

    this.id = this.normalized;
    this.hashId = hashName( this.id, builder.usedIds, 5 );

    this.isEntry = !!isEntry;
    this.loadResult = loadResult;

    this.checker = new Checker( this, builder );
    this.lang = null;

    this.type = "";
    this.data = "";
    this.originalData = "";
    this.ast = null;
    this.maps = [];
    this.deps = [];
    this.moduleDeps = [];
    this.importedNames = [];
    this.exportedNames = [];

    this.transforming = null;
    this.resolving = null;
  }

  moduleError( message: string ) {
    throw new Error( `${message}. Module: ${this.normalized}` );
  }

  error( message: string, loc: ?Loc ) {
    error( message, {
      id: this.id,
      originalCode: loc && this.originalData && this.originalData.toString(),
      code: loc && this.data.toString(),
      mapChain: this.maps
    }, loc );
  }

  async _handleDeps( builder: Builder, lang: Language, deps: NotResolvedDep[] ): Promise<Dep[]> {
    const p = deps.map( async obj => {

      const { request, loc, async } = obj;

      if ( !request ) {
        throw this.error( "Empty import", loc );
      }

      let path;

      for ( const { plugin } of builder.plugins ) {
        const fn = plugin.resolve;
        if ( fn ) {
          // $FlowFixMe
          const result = await fn( request, this, builder );
          if ( result ) {
            path = result;
            break;
          }
        }
      }

      if ( !path ) {
        throw this.error( `Could not resolve ${request}`, loc );
      }

      if ( !isAbsolute( path ) ) {
        throw this.error( `Resolution returned a non absolute path: ${path}`, loc );
      }

      if ( path === this.path ) {
        throw this.error( "A module cannot import itself", loc );
      }

      if ( builder.isDest( path ) ) {
        throw this.error( "Don't import the destination file", loc );
      }

      return {
        path,
        request,
        loc,
        async
      };
    } );

    return Promise.all( p );
  }

  async _transform( builder: Builder ): Promise<Language> {

    let result = this.loadResult;
    const maps = [];

    if ( result == null ) {
      try {
        result = await builder.applyPluginPhaseFirst( "load", ( result, name ) => {
          return handleOutput( result, null, maps, "Load", name );
        }, this.path );
      } catch ( err ) {
        if ( err.code === "ENOENT" ) {
          throw error( `Could not find ${this.normalized}` );
        }
        throw err;
      }
    }

    this.originalData = result.data;

    result = await builder.applyPluginPhasePipe( "transform", ( result, prevResult, name ) => {
      return handleOutput( result, prevResult.data, maps, "Transform", name );
    }, result, this );

    this.type = result.type;
    this.data = result.data;
    this.ast = result.ast;
    this.maps = maps;

    const lang = this.lang = await builder.applyPluginPhaseFirst( "getLanguage", ( result, name ) => {
      if ( result instanceof Language ) {
        return result;
      }
      throw error( `'getLanguage' hook${name ? " from " + name : ""} did not return a Language` );
    }, this );

    return lang;
  }

  async _resolveDeps( builder: Builder, lang: Language ) {

    const depsInfo = await lang.dependencies();

    this.deps = await this._handleDeps( builder, lang, depsInfo.dependencies );

    this.moduleDeps = this.deps.map( dep => {
      const requiredId = builder.addModule( {
        path: dep.path,
        isEntry: false,
        builder
      } ).id;
      return Object.assign( {}, dep, { requiredId } );
    } );

    this.importedNames = depsInfo.importedNames;
    this.exportedNames = depsInfo.exportedNames;
  }

  transform( builder: Builder ) {
    return this.transforming || ( this.transforming = this._transform( builder ) );
  }

  resolveDeps( builder: Builder, lang: Language ) {
    return this.resolving || ( this.resolving = this._resolveDeps( builder, lang ) );
  }

  async load( builder: Builder ) {
    await this.resolveDeps( builder, await this.transform( builder ) );
  }

  getModuleByRequest( builder: Builder, request: string ): ?Module {
    const dep = this.moduleDeps.find( dep => dep.request === request );
    if ( dep ) {
      return builder.getModule( dep.requiredId );
    }
  }

  resetDeps() {
    this.deps.length = 0;
    this.moduleDeps.length = 0;
    this.resolving = null;
  }

}

function handleOutput( out, prevData, maps, hook, pluginName ): LoaderOutput {

  const _from = `${hook} hook${pluginName ? " from " + pluginName : ""}`;

  if ( !isObject( out ) || typeof out.type !== "string" ) {
    throw error( `${_from} should return { type: string, data: Buffer | string }` );
  }

  if ( out.code && out.data ) {
    throw error( `${_from} should not return an object with both "data" and "code"` );
  }

  let data = out.code == null ? out.data : out.code;

  if ( out.ast ) {
    if ( prevData == null ) {
      throw error( `${_from} should not return ast` );
    }
    if ( data || out.map ) {
      throw error( `${_from} should not return data and/or source map with ast` );
    }
    data = prevData;
  }

  if ( typeof data !== "string" && !Buffer.isBuffer( data ) ) {
    throw error( `${_from} should return valid data: Buffer or string` );
  }

  if ( out.map ) {
    if ( isObject( out.map ) ) {
      maps.push( out.map );
    } else {
      throw error( `${_from} should return valid source map object or none` );
    }
  }

  if ( out.ast && !isObject( out.ast ) ) {
    throw error( `${_from} should return valid ast object or none` );
  }

  return {
    type: out.type,
    data,
    ast: out.ast,
    map: out.map
  };
}
