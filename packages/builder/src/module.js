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
const EMPTY_ARR = [];

function isObject( obj ) {
  return obj != null && typeof obj === "object";
}

export type ModuleArg = {
  path: string,
  index?: ?number,
  isEntry?: ?boolean,
  initialOuput?: ?LoaderOutput,
  loc?: ?Loc,
  builder: Builder
};

// Note: don't save references for other modules in a module. That can break incremental builds.

export default class Module {

  +path: string;
  +index: number;
  +normalized: string;
  +dest: string;
  +id: string;
  +hashId: string;
  +isEntry: boolean;
  +initialOuput: ?LoaderOutput;
  +locOffset: ?Loc;
  +checker: Checker;
  lang: ?ILanguage;
  type: string;
  originalData: Data;
  lastOutput: LoaderOutput;
  maps: Object[];
  moduleDeps: ( Dep & { requiredId: string } )[];
  importedNames: ImportedName[];
  exportedNames: ExportedName[];
  transforming: ?Promise<Language>;
  resolving: ?Promise<void>;

  constructor( { path, index, isEntry, initialOuput, loc, builder }: ModuleArg ) {
    this.path = path;
    this.index = index || 0;
    this.normalized = relative( path, builder.context );
    this.dest = resolvePath( this.normalized, builder.dest );

    this.id = index ? `${this.normalized} (index:${index})` : this.normalized;
    this.hashId = builder.optimization.hashId ? hashName( this.id, builder.usedIds, 5 ) : this.id;

    this.isEntry = !!isEntry;
    this.initialOuput = initialOuput;
    this.locOffset = loc;

    this.checker = new Checker( this, builder );
    this.lang = null;

    this.type = "";
    this.originalData = "";
    this.lastOutput = {
      type: "",
      data: "",
      map: null,
      ast: null
    };
    this.maps = EMPTY_ARR;

    this.moduleDeps = EMPTY_ARR;
    this.importedNames = EMPTY_ARR;
    this.exportedNames = EMPTY_ARR;

    this.transforming = null;
    this.resolving = null;
  }

  moduleError( message: string ) {
    throw new Error( `${message}. Module: ${this.normalized}` );
  }

  getOriginalCode(): ?string {
    const data = this.originalData;
    return data && data.toString();
  }

  getCode(): ?string {
    const data = this.lastOutput && this.lastOutput.data;
    return data && data.toString();
  }

  error( message: string, loc: ?Loc ) {
    error( message, {
      id: this.id,
      originalCode: loc && this.getOriginalCode(),
      code: loc && this.getCode(),
      mapChain: this.maps
    }, loc );
  }

  async _handleDep( builder: Builder, { request, output, loc, async }: NotResolvedDep ) {

    if ( !request ) {
      throw this.error( "Empty import", loc );
    }

    let path;

    if ( output ) {

      path = this.path;

    } else {

      for ( const { plugin } of builder.plugins ) {
        const fn = plugin.resolve;
        if ( fn ) {
          const result = await fn( request, this, builder );
          if ( typeof result === "string" ) {
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

    }

    return {
      path,
      output,
      request,
      loc,
      async
    };
  }

  async _transform( builder: Builder ): Promise<Language> {

    let result = this.initialOuput;
    const maps = [];

    if ( result == null ) {
      try {
        result = await builder.applyPluginPhaseFirst(
          "load",
          ( result, name ) => handleOutput( result, maps, "Load", name ),
          this.path
        );
      } catch ( err ) {
        if ( err.code === "ENOENT" ) {
          throw error( `Could not find ${this.normalized}` );
        }
        throw err;
      }
    }

    this.originalData = result.data;

    result = await builder.applyPluginPhasePipe(
      "transform",
      ( result, name ) => handleOutput( result, maps, "Transform", name ),
      result,
      this
    );

    this.type = result.type;
    this.maps = maps;
    this.lastOutput = {
      type: result.type,
      data: result.data,
      map: null,
      ast: result.ast
    };

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

    const p = [];
    for ( const dep of depsInfo.dependencies || EMPTY_ARR ) {
      p.push( this._handleDep( builder, dep ) );
    }

    const deps = await Promise.all( p );
    const moduleDeps = [];

    let index = 1;

    for ( const { path, request, loc, async, output } of deps ) {

      let requiredId;

      if ( output ) {
        requiredId = builder.addModule( {
          path,
          index: index++,
          initialOuput: output,
          loc,
          builder
        } ).id;
      } else {
        requiredId = builder.addModule( {
          path,
          builder
        } ).id;
      }

      moduleDeps.push( {
        path,
        request,
        loc,
        async,
        requiredId
      } );
    }

    this.moduleDeps = moduleDeps;
    this.importedNames = depsInfo.importedNames || EMPTY_ARR;
    this.exportedNames = depsInfo.exportedNames || EMPTY_ARR;
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
    this.moduleDeps.length = 0;
    this.resolving = null;
  }

}

function handleOutput( out, maps, hook, pluginName ): LoaderOutput {

  const _from = `${hook} hook${pluginName ? " from " + pluginName : ""}`;

  if ( !isObject( out ) ) {
    throw error( `${_from} should return { type: string, data: Buffer | string }` );
  }

  const { type, data, map, ast } = out;

  if ( typeof type !== "string" ) {
    throw error( `${_from} should return { type: string, data: Buffer | string }` );
  }

  if ( typeof data !== "string" && !Buffer.isBuffer( data ) ) {
    throw error( `${_from} should return valid data: Buffer or string` );
  }

  if ( ast ) {

    if ( typeof ast !== "object" ) {
      throw error( `${_from} should return valid ast object or none` );
    }

    if ( map ) {
      throw error( `${_from} should not return source map with ast` );
    }

    return {
      type,
      data,
      map: null,
      ast
    };
  }

  if ( map ) {
    if ( typeof map === "object" ) {
      maps.push( map );
    } else {
      throw error( `${_from} should return valid source map object or none` );
    }
  }

  return {
    type,
    data,
    map,
    ast: null
  };
}
