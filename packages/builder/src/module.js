// @flow

import error from "./utils/error";
import { hashName } from "./utils/hash";
import type Builder from "./builder";
import Language, { type ILanguage } from "./language";
import type {
  LoaderOutput, Data, Loc, ImportedName, ExportedName,
  Dep, NotResolvedDep, QueryArr, Query
} from "./types";
import { relative, resolvePath } from "./id";
import { Checker } from "./checker";

const getPlugins = require( "@quase/get-plugins" ).getPlugins;
const { joinSourceMaps } = require( "@quase/source-map" );
const JSON5 = require( "json5" );

function isObject( obj ) {
  return obj != null && typeof obj === "object";
}

export type ModuleArg = {
  request: { path: string, query: Query },
  isEntry?: ?boolean,
  loadResult?: ?LoaderOutput,
  builder: Builder
};

// Note: don't save references for other modules in a module. That can break incremental builds.

export default class Module {

  +path: string;
  +query: Query;
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
  maps: Object[];
  deps: Dep[];
  moduleDeps: ( Dep & { requiredId: string } )[];
  importedNames: ImportedName[];
  exportedNames: ExportedName[];
  transforming: ?Promise<Language>;
  resolving: ?Promise<void>;

  constructor( { request: { path, query }, isEntry, loadResult, builder }: ModuleArg ) {
    this.path = path;
    this.query = query;
    this.normalized = relative( path, builder.context );
    this.dest = resolvePath( this.normalized, builder.dest );

    this.id = `${this.normalized}${query.default ? "" : `!!${query.str}`}`;
    this.hashId = hashName( this.id, builder.usedIds, 5 );

    this.isEntry = !!isEntry;
    this.loadResult = loadResult;

    this.checker = new Checker( this, builder );
    this.lang = null;

    this.type = "";
    this.data = "";
    this.maps = [];
    this.deps = [];
    this.moduleDeps = [];
    this.importedNames = [];
    this.exportedNames = [];

    this.transforming = null;
    this.resolving = null;
  }

  static parseRequest( request: string ): [string, string] {
    const idx = request.indexOf( "!!" );
    const path = idx < 0 ? request : request.slice( 0, idx );
    const query = idx < 0 ? "" : request.slice( idx + 1 );
    return [ path, query ];
  }

  static parseQuery( str: string ): Query {
    let parsed;

    try {
      parsed = JSON5.parse( str || "[]" );
    } catch ( e ) {
      // Ignore
    }

    if ( !Array.isArray( parsed ) ) {
      throw new Error( `Invalid query ${str}` );
    }

    const arr = parsed.filter( Boolean );
    return {
      arr,
      str: Module.queryArrToString( arr )
    };
  }

  static queryArrToString( arr: QueryArr ) {
    return arr.length === 0 ? "" : JSON5.stringify( arr );
  }

  moduleError( message: string ) {
    throw new Error( `${message}. Module: ${this.normalized}` );
  }

  error( message: string, loc: ?Loc ) {
    error( message, {
      id: this.normalized,
      code: loc && this.data.toString(),
      map: loc && joinSourceMaps( this.maps )
    }, loc );
  }

  async _handleDeps( builder: Builder, lang: Language, deps: NotResolvedDep[] ): Promise<Dep[]> {
    const p = deps.map( async obj => {

      const { request, loc, async } = obj;
      let [ path, queryStr ] = Module.parseRequest( request );

      if ( !request ) {
        throw this.error( "Empty import", loc );
      }

      path = await lang.resolve( path, this.path, builder );

      if ( !path ) {
        throw this.error( `Could not resolve ${request}`, loc );
      }

      path = resolvePath( path, builder.cwd );

      if ( path === this.path ) {
        throw this.error( "A module cannot import itself", loc );
      }

      if ( builder.isDest( path ) ) {
        throw this.error( "Don't import the destination file", loc );
      }

      const query = Module.parseQuery( queryStr );

      return {
        path,
        query: query.arr.length ? query : builder.getDefaultQuery( path ),
        request,
        loc,
        async
      };
    } );

    return Promise.all( p );
  }

  async _transform( builder: Builder ): Promise<Language> {

    let result = this.loadResult;

    if ( result == null ) {
      try {
        result = await builder.applyPluginPhaseFirst( "load", this.path );
      } catch ( err ) {
        if ( err.code === "ENOENT" ) {
          throw error( `Could not find ${this.normalized}` );
        }
        throw err;
      }
    }

    if ( !isObject( result ) ) {
      throw error( "Load should return { type: string, data: Buffer | string }" );
    }

    const maps = [];

    const loaders = getPlugins( this.query.arr, name => builder.loaderAlias[ name ] );

    for ( const { plugin, options } of loaders ) {
      const out = await plugin(
        Object.assign( {}, result ),
        options,
        module,
        builder
      );
      if ( isObject( out ) ) {
        result.type = out.type;
        result.data = out.data;
        result.ast = out.ast;
        if ( out.map ) {
          maps.push( out.map );
        }
      }
    }

    this.type = result.type;
    this.data = result.data;
    this.maps = maps;

    const [ C, opts ] = builder.languages[ result.type ] || [ Language, {} ];

    const lang = new C( result, opts, this, builder );
    this.lang = lang;
    return lang;
  }

  async _resolveDeps( builder: Builder, lang: Language ) {

    this.deps = await this._handleDeps(
      builder,
      lang,
      await lang.dependenciesImpl()
    );

    this.moduleDeps = this.deps.map( dep => {
      const { path, query } = dep;
      const requiredId = builder.addModule( {
        request: { path, query },
        isEntry: false,
        builder
      } ).id;
      return Object.assign( {}, dep, { requiredId } );
    } );

    this.importedNames = await lang.importedNamesImpl();
    this.exportedNames = await lang.exportedNamesImpl();

    // TODO
    /* const moreLangs = await lang.moreLanguagesImpl();
    for ( const { type, data } of moreLangs ) {
      builder.addModule( type, lang.path, data );
    }*/
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
