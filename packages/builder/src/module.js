// @flow
import error from "./utils/error";
import { hashName } from "./utils/hash";
import type Builder from "./builder";
import type {
  Data, Loc, TransformOutput, InnerModule,
  ImportedName, ExportedName,
  DepsInfo, NotResolvedDep, ModuleDep
} from "./types";
import { relative, resolvePath, lowerPath } from "./id";
import { Checker } from "./checker";
import ModuleUtils from "./module-utils";

/* eslint-disable no-use-before-define */

const { isAbsolute } = require( "path" );
const EMPTY_DEPS: $ReadOnlyArray<NotResolvedDep> = [];
const EMPTY_IMPORTS: $ReadOnlyArray<ImportedName> = [];
const EMPTY_EXPORTS: $ReadOnlyArray<ExportedName> = [];

export type ModuleArg = {
  +builder: Builder,
  +path: string,
  +type: string,
  +index: number,
  +isEntry?: ?boolean,
  +loc?: ?Loc,
  +inner?: ?InnerModule,
  +parent?: ?Module
};

export type ModuleNotLoaded = {
  +state: 0
};

export type ModuleLoaded = {
  +state: 1,
  +result: TransformOutput,
};

export type ModuleTransformed = {
  +state: 2,
  +result: TransformOutput
};

export type ModuleWithDeps = {
  +state: 3,
  +result: TransformOutput,
  +depsInfo: DepsInfo
};

export type ModuleWithResolvedDeps = {
  +state: 4,
  +result: TransformOutput,
  +depsInfo: DepsInfo,
  +moduleDeps: Map<string, ModuleDep>
};

export type ModuleState = ModuleNotLoaded | ModuleLoaded | ModuleTransformed | ModuleWithDeps | ModuleWithResolvedDeps;

export default class Module {

  +id: string;
  +path: string;
  +type: string;
  +index: number;
  +relative: string;
  +dest: string;
  +normalized: string;
  +hashId: string;
  +isEntry: boolean;
  +locOffset: ?Loc;
  +checker: Checker;
  +parent: ?Module;
  +utils: ModuleUtils;
  originalData: ?Data;
  originalMap: ?Object;
  state: ModuleState;
  loading: ?Promise<ModuleLoaded>;
  transforming: ?Promise<ModuleTransformed>;
  gettingDeps: ?Promise<ModuleWithDeps>;
  resolvingDeps: ?Promise<ModuleWithResolvedDeps>;

  constructor( id: string, { builder, path, type, index, isEntry, loc, inner, parent }: ModuleArg ) {
    this.id = id;
    this.path = path;
    this.type = type;
    this.index = index;
    this.relative = relative( path, builder.context );
    this.dest = resolvePath( this.relative, builder.dest );
    this.normalized = this.relative;

    this.hashId = builder.optimization.hashId ? hashName( this.id, builder.usedIds, 5 ) : this.id;

    this.isEntry = !!isEntry;
    this.locOffset = loc;

    this.originalData = inner ? inner.data : null;
    this.originalMap = inner ? inner.map : null;

    this.checker = new Checker( this, builder );

    this.utils = new ModuleUtils( this, builder );

    this.parent = parent;
    if ( parent ) builder.addRef( this, parent, "byParent" );

    this.state = {
      state: 0
    };

    this.loading = null;
    this.transforming = null;
    this.gettingDeps = null;
    this.resolvingDeps = null;
  }

  moduleError( message: string ) {
    throw new Error( `${message}. Module: ${this.normalized}` );
  }

  getOriginalCode(): ?string {
    const data = this.originalData;
    return data && data.toString();
  }

  getCode(): ?string {
    const state = this.state;
    if ( state.state === 0 || state.state === 1 ) {
      return;
    }
    return state.result.data.toString();
  }

  getMap(): ?Object {
    const state = this.state;
    if ( state.state === 0 || state.state === 1 ) {
      return;
    }
    return state.result.map;
  }

  error( message: string, loc: ?Loc ) {
    error( message, {
      id: this.normalized,
      originalCode: loc && this.getOriginalCode(),
      code: loc && this.getCode(),
      map: loc && this.getMap()
    }, loc );
  }

  async _load( builder: Builder ): Promise<ModuleLoaded> {
    try {

      let data, map, ast, final;

      // For inline dependency module
      if ( this.originalData ) {

        data = this.originalData;
        map = this.originalMap;

      } else {
        const parent = this.parent;

        // For modules generated from other module in different type
        if ( parent ) {
          const parentTransform = await parent.transform( builder );
          const result = await builder.pluginsRunner.generate( this.type, parentTransform.result, this.utils, parent.utils );

          data = result.data;
          map = result.map;
          ast = result.ast;
          final = result.final;

        // Original module from disk
        } else {
          data = await builder.pluginsRunner.load( this.path, this.utils );
        }

        this.originalData = data;
        this.originalMap = map;
      }

      const state = this.state = {
        state: 1,
        result: {
          data,
          map,
          ast,
          final
        }
      };

      return state;
    } catch ( err ) {
      if ( err.code === "ENOENT" ) {
        throw error( `Could not find ${this.normalized}` );
      }
      throw err;
    }
  }

  async _transform( builder: Builder ): Promise<ModuleTransformed> {

    const { result: initial } = await this.load( builder );

    const { data, ast, map } = await builder.pluginsRunner.transform( initial, this.utils );

    const state = this.state = {
      state: 2,
      result: {
        data,
        ast,
        map,
      }
    };

    return state;
  }

  async _getDeps( builder: Builder ): Promise<ModuleWithDeps> {

    const { result } = await this.transform( builder );

    const depsInfo = await builder.pluginsRunner.dependencies( result, this.utils );

    const state = this.state = {
      state: 3,
      result,
      depsInfo,
      promise: null
    };

    return state;
  }

  async _handleDep( builder: Builder, { request, inner, loc, async }: NotResolvedDep ) {

    if ( !request ) {
      throw this.error( "Empty import", loc );
    }

    let path;

    if ( inner ) {

      path = this.path;

    } else {

      path = await builder.pluginsRunner.resolve( request, this.utils );

      if ( !path || typeof path !== "string" ) {
        throw this.error( `Could not resolve ${request}`, loc );
      }

      if ( !isAbsolute( path ) ) {
        throw this.error( `Resolution returned a non absolute path: ${path}`, loc );
      }

      path = lowerPath( path );

      if ( path === this.path ) {
        throw this.error( "A module cannot import itself", loc );
      }

      if ( builder.isDest( path ) ) {
        throw this.error( "Don't import the destination file", loc );
      }

    }

    return {
      path,
      inner,
      request,
      loc,
      async
    };
  }

  async _resolveDeps( builder: Builder ): Promise<ModuleWithResolvedDeps> {

    const { result, depsInfo } = await this.getDeps( builder );

    const parent = this.parent;
    const parentModuleDeps = parent ? ( await parent.resolveDeps( builder ) ).moduleDeps : new Map();

    const p = [];
    for ( const dep of depsInfo.dependencies || EMPTY_DEPS ) {
      if ( !parentModuleDeps.has( dep.request ) ) {
        p.push( this._handleDep( builder, dep ) );
      }
    }

    const moduleDeps = new Map();
    const deps = await Promise.all( p );

    for ( const { path, inner, request, loc, async } of deps ) {

      let required;

      if ( inner ) {
        required = builder.addModuleAndGenerate( {
          builder,
          path,
          type: inner.type,
          index: inner.index,
          loc,
          inner
        }, this );
      } else {
        required = builder.addModuleAndGenerate( {
          builder,
          path,
          type: builder.pluginsRunner.getType( path ),
          index: -1
        }, this );
      }

      const splitPoint = builder.pluginsRunner.isSplitPoint( this.utils, required.utils ) || !!async;

      moduleDeps.set( request, {
        path,
        request,
        loc,
        async,
        splitPoint,
        required,
        inherit: false
      } );

      builder.addRef( this, required, "byDep" );
    }

    for ( const { path, request, loc, async, splitPoint, required } of parentModuleDeps.values() ) {

      // TODO generation?

      moduleDeps.set( request, {
        path,
        request,
        loc,
        async,
        splitPoint,
        required,
        inherit: true
      } );

      builder.addRef( this, required, "byDep" );
    }

    const state = this.state = {
      state: 4,
      result,
      depsInfo,
      moduleDeps
    };

    return state;
  }

  async load( builder: Builder ) {
    return this.loading || ( this.loading = this._load( builder ) );
  }

  async transform( builder: Builder ) {
    return this.transforming || ( this.transforming = this._transform( builder ) );
  }

  async getDeps( builder: Builder ) {
    return this.gettingDeps || ( this.gettingDeps = this._getDeps( builder ) );
  }

  async resolveDeps( builder: Builder ) {
    return this.resolvingDeps || ( this.resolvingDeps = this._resolveDeps( builder ) );
  }

  async process( builder: Builder ): Promise<void> {
    await this.resolveDeps( builder );
  }

  generate( builder: Builder, newType: string ): Module {
    return builder.addModule( {
      builder,
      path: this.path,
      index: this.index,
      type: newType,
      parent: this
    } );
  }

  resetDeps( builder: Builder ) {
    const currState = this.state;

    if ( currState.state === 4 ) {

      for ( const { required } of currState.moduleDeps.values() ) {
        builder.removeRef( this, required, "byDep" );
      }

      this.state = {
        state: 3,
        result: currState.result,
        depsInfo: currState.depsInfo
      };
    }

    this.resolvingDeps = null;
  }

  getModuleByRequest( request: string ): ?Module {
    const dep = this.getModuleDeps().get( request );
    return dep && dep.required;
  }

  getModuleDeps(): Map<string, ModuleDep> {
    const state = this.state;
    if ( state.state !== 4 ) {
      throw new Error( `Internal: Cannot call getModuleDeps on module ${this.id} in state ${state.state}` );
    }
    return state.moduleDeps;
  }

  getImportedNames() {
    const state = this.state;
    if ( state.state !== 4 ) {
      throw new Error( `Internal: Cannot call getImportedNames on module ${this.id} in state ${state.state}` );
    }
    return state.depsInfo.importedNames || EMPTY_IMPORTS;
  }

  getExportedNames() {
    const state = this.state;
    if ( state.state !== 4 ) {
      throw new Error( `Internal: Cannot call getExportedNames on module ${this.id} in state ${state.state}` );
    }
    return state.depsInfo.exportedNames || EMPTY_EXPORTS;
  }

}
