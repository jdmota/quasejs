// @flow
import { Computation, type ComputationApi } from "../utils/data-dependencies";
import error from "../utils/error";
import type Builder, { Build } from "../builder";
import type {
  Data, Loc, LoadOutput, TransformOutput, DepsInfo, NotResolvedDep, ResolvedDep, ModuleDep
} from "../types";
import { relative, resolvePath, lowerPath } from "../id";
import { ModuleUtils, ModuleUtilsWithFS } from "./utils";

/* eslint-disable no-use-before-define */

const { isAbsolute } = require( "path" );
const { joinSourceMaps } = require( "@quase/source-map" );

export type ModuleArg = {
  +builder: Builder,
  +path: string,
  +type: string,
  +loc?: ?Loc,
  +innerId?: ?string,
  +parentInner?: ?Module,
  +parentGenerator?: ?Module
};

export default class Module {

  +id: string;
  +path: string;
  +type: string;
  +innerId: ?string;
  +relative: string;
  +dest: string;
  +normalized: string;
  +builder: Builder;
  +parentInner: ?Module;
  +parentGenerator: ?Module;
  +utils: ModuleUtils;
  buildId: number;
  locOffset: ?Loc;
  originalData: ?Data;
  originalMap: ?Object;
  result: ?TransformOutput;
  +load: Computation<LoadOutput>;
  +transform: Computation<TransformOutput>;
  +getDeps: Computation<DepsInfo>;
  +resolveDeps: Computation<Map<string, ModuleDep>>;

  constructor( id: string, { builder, path, type, loc, innerId, parentInner, parentGenerator }: ModuleArg ) {
    this.id = id;
    this.path = path;
    this.type = type;
    this.innerId = innerId;
    this.relative = relative( path, builder.context );
    this.dest = resolvePath( this.relative, builder.dest );
    this.normalized = this.relative;
    this.builder = builder;

    this.locOffset = loc;
    this.originalData = null;
    this.originalMap = null;
    this.result = null;

    this.utils = new ModuleUtils( this );

    this.parentInner = parentInner;
    this.parentGenerator = parentGenerator;

    this.buildId = 0;

    this.load = new Computation( c => this._load( c ) );
    this.transform = new Computation( c => this._transform( c ) );
    this.getDeps = new Computation( c => this._getDeps( c ) );
    this.resolveDeps = new Computation( ( c, b ) => this._resolveDeps( c, b ) );
  }

  unref() {
    this.load.invalidate();
    this.transform.invalidate();
    this.getDeps.invalidate();
    this.resolveDeps.invalidate();
  }

  moduleError( message: string ) {
    throw new Error( `${message}. Module: ${this.normalized}` );
  }

  error( message: string, loc: ?Loc ) {
    const result = this.result;

    if ( result && result.ast ) {

      const { originalData } = this;
      /* const locOffset = this.locOffset;

      if ( loc && locOffset ) {
        loc = {
          line: loc.line + locOffset.line - 1,
          column: loc.column == null ? null : loc.column + ( loc.line === 1 ? locOffset.column : 0 )
        };
      }*/

      error( message, {
        id: this.id,
        code: originalData == null ? null : originalData.toString(),
        loc
      }, this.builder.codeFrameOptions );

    } else {

      error( message, {
        id: this.id,
        loc
      }, this.builder.codeFrameOptions );
    }
  }

  async _load( computation: ComputationApi ): Promise<LoadOutput> {
    try {

      let data, map;

      const parentInner = this.parentInner;
      const innerId = this.innerId;

      // For inline dependency module
      if ( parentInner ) {

        if ( !innerId ) {
          throw new Error( `Internal: missing innerId - ${this.id}` );
        }

        const parentDeps = await computation.get( parentInner.getDeps );
        const result = parentDeps.innerDependencies.get( innerId );

        if ( !result ) {
          throw new Error( `Internal: Could not get inner dependency content - ${this.id}` );
        }

        if ( this.builder.optimization.sourceMaps ) {
          const parentLoad = await computation.get( parentInner.load );
          data = result.data;
          map = joinSourceMaps( [ parentLoad.map ] ); // FIXME result.map should be created by us
        } else {
          data = result.data;
        }

        this.locOffset = result.loc;

      } else {
        const parentGenerator = this.parentGenerator;

        // For modules generated from other module in different type
        if ( parentGenerator ) {
          const parentTransform = await computation.get( parentGenerator.transform );
          const result = await this.builder.pluginsRunner.transformType(
            parentTransform,
            new ModuleUtilsWithFS( this, computation ),
            parentGenerator.utils
          );

          if ( this.builder.optimization.sourceMaps ) {
            const parentLoad = await computation.get( parentGenerator.load );
            data = result.data;
            map = joinSourceMaps( [ parentLoad.map, result.map ] );
          } else {
            data = result.data;
          }

          this.locOffset = parentGenerator.locOffset;

        // Original module from disk
        } else {
          data = await this.builder.pluginsRunner.load( this.path, new ModuleUtilsWithFS( this, computation ) );
        }
      }

      this.originalData = data;
      this.originalMap = map;

      return {
        data,
        map
      };
    } catch ( err ) {
      if ( err.code === "ENOENT" ) {
        throw error( `Could not find ${this.normalized}` );
      }
      throw err;
    }
  }

  async _transform( computation: ComputationApi ): Promise<TransformOutput> {
    const { data } = await computation.get( this.load );
    const ast = await this.builder.pluginsRunner.parse( data, this.utils );

    let result, finalAst, finalBuffer;

    if ( ast ) {
      finalAst = await this.builder.pluginsRunner.transformAst( ast, new ModuleUtilsWithFS( this, computation ) );
      result = {
        ast: finalAst,
        buffer: null
      };
    } else {
      if ( typeof data === "string" ) {
        throw new Error( "Internal: expected buffer" );
      }

      finalBuffer = await this.builder.pluginsRunner.transformBuffer( data, new ModuleUtilsWithFS( this, computation ) );
      result = {
        ast: null,
        buffer: finalBuffer
      };
    }

    this.result = result;
    return result;
  }

  async _getDeps( computation: ComputationApi ): Promise<DepsInfo> {
    const ast = await computation.get( this.transform );
    return this.builder.pluginsRunner.dependencies( ast, this.utils );
  }

  async _handleDep( request: string, { loc, async }: NotResolvedDep, utils: ModuleUtilsWithFS ): Promise<ResolvedDep> {

    if ( !request ) {
      throw this.error( "Empty import", loc );
    }

    let path = await this.builder.pluginsRunner.resolve( request, utils );

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

    if ( this.builder.isDest( path ) ) {
      throw this.error( "Don't import the destination file", loc );
    }

    return {
      path,
      request,
      loc,
      async
    };
  }

  async _resolveDeps( computation: ComputationApi, build: Build ): Promise<Map<string, ModuleDep>> {

    const moduleDeps = new Map();
    const utils = new ModuleUtilsWithFS( this, computation );
    const depsInfo = await computation.get( this.getDeps );

    const parent = this.parentGenerator;
    const parentModuleDeps = parent ? await computation.get( parent.resolveDeps ) : new Map();

    const p = [];
    for ( const [ request, dep ] of depsInfo.dependencies ) {
      if ( !parentModuleDeps.has( request ) ) {
        p.push( this._handleDep( request, dep || {}, utils ) );
      }
    }

    const deps = await Promise.all( p );

    // Handle normal dependencies
    for ( const { path, request, loc, async } of deps ) {

      const required = build.addModuleAndTransform( {
        builder: this.builder,
        path,
        type: this.builder.pluginsRunner.getType( path )
      }, this );

      let splitPoint = this.builder.pluginsRunner.isSplitPoint( this.utils, required.utils );

      if ( splitPoint == null ) {
        splitPoint = !!async || required.type !== this.type;
      }

      moduleDeps.set( request, {
        path,
        request,
        loc,
        async,
        splitPoint,
        required,
        inherit: false
      } );
    }

    // Handle inner dependencies
    for ( const [ innerId, dep ] of depsInfo.innerDependencies ) {
      if ( parentModuleDeps.has( innerId ) ) {
        continue;
      }

      const path = this.path;
      const { type, loc, async } = dep;

      const required = build.addModuleAndTransform( {
        builder: this.builder,
        path,
        type,
        loc,
        innerId,
        parentInner: this
      }, this );

      let splitPoint = this.builder.pluginsRunner.isSplitPoint( this.utils, required.utils );

      if ( splitPoint == null ) {
        splitPoint = !!async;
      }

      moduleDeps.set( innerId, {
        path,
        request: innerId,
        loc,
        async,
        splitPoint,
        required,
        inherit: false
      } );
    }

    for ( const { path, request, loc, async, splitPoint, required: originalRequired } of parentModuleDeps.values() ) {

      const required = build.transformModuleType( originalRequired, this );

      moduleDeps.set( request, {
        path,
        request,
        loc,
        async,
        splitPoint,
        required,
        inherit: true
      } );
    }

    return moduleDeps;
  }

  async process( build: Build ): Promise<void> {
    if ( this.buildId === build.buildId ) {
      return;
    }
    this.buildId = build.buildId;

    const parent = this.parentGenerator;
    if ( parent ) {
      build.process( parent );
    }

    const moduleDeps = await this.resolveDeps.get( build );
    for ( const { required } of moduleDeps.values() ) {
      build.process( required );
    }
  }

  newModuleType( build: Build, newType: string ): Module {
    return build.addModule( {
      builder: this.builder,
      path: this.path,
      innerId: this.innerId,
      type: newType,
      loc: this.locOffset,
      parentGenerator: this
    } );
  }

}
