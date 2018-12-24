// @flow
import { Computation, type ComputationApi } from "./utils/data-dependencies";
import { relative, lowerPath } from "./utils/path";
import error from "./utils/error";
import type {
  Data, Loc, LoadOutput, TransformOutput, PipelineResult, NotResolvedDep, DepsInfo, ModuleDep
} from "./types";
import type Builder, { Build } from "./builder";
import { ModuleContext, ModuleContextWithoutFS } from "./plugins/context";
import { Checker } from "./checker";

/* eslint-disable no-use-before-define */

const { isAbsolute } = require( "path" );
const { joinSourceMaps } = require( "@quase/source-map" );

export type ModuleInfo = {
  +id: string;
  +type: string;
  +innerId: ?string;
  +path: string;
  +relativePath: string;
  +relativeDest: string;
  +normalized: string;
};

export type ModuleArg = {
  +builder: Builder,
  +prevId: ?string,
  +path: string,
  +type: string,
  +loc?: ?Loc,
  +innerId?: ?string,
  +parentInner?: ?Module,
  +parentGenerator?: ?Module
};

async function resolve( m: Module, request: string, loc: ?Loc, computation: ComputationApi ) {
  const ctx = new ModuleContext( m.builder.options, m );

  if ( !request ) {
    throw m.error( "Empty import", loc );
  }

  let path;

  try {
    path = await m.builder.pluginsRunner.resolve( request, ctx );
  } finally {
    // Register before sending an error
    m.builder.registerFiles( ctx.files, computation );
  }

  if ( !path || typeof path !== "string" ) {
    throw m.error( `Could not resolve ${request}`, loc );
  }

  if ( !isAbsolute( path ) ) {
    throw m.error( `Resolution returned a non absolute path: ${path}`, loc );
  }

  path = lowerPath( path );

  if ( path === m.path ) {
    throw m.error( "A module cannot import itself", loc );
  }

  if ( m.ctx.isDest( path ) ) {
    throw m.error( "Don't import the destination file", loc );
  }

  return path;
}

export default class Module {

  +id: string;
  +path: string;
  +type: string;
  +innerId: ?string;
  +relativePath: string;
  +relativeDest: string;
  +normalized: string;
  +builder: Builder;
  +parentInner: ?Module;
  +parentGenerator: ?Module;
  +ctx: ModuleContextWithoutFS;
  +load: Computation<LoadOutput>;
  +pipeline: Computation<PipelineResult>;
  +resolveDeps: Computation<Map<string, ModuleDep>>;
  buildId: number;
  lastChangeId: number;
  locOffset: ?Loc;
  originalData: ?Data;
  originalMap: ?Object;
  wasParsed: boolean;
  checker: Checker;
  hashId: string;
  loadResult: LoadOutput;
  transformResult: TransformOutput;
  depsInfo: DepsInfo;
  deps: Map<string, ModuleDep>;

  constructor( id: string, { builder, path, type, loc, innerId, parentInner, parentGenerator }: ModuleArg ) {
    this.id = id;
    this.type = type;
    this.innerId = innerId;
    this.path = path;
    this.relativePath = relative( path, builder.options.context );
    this.relativeDest =
      parentInner ? `${parentInner.relativeDest}.${innerId || ""}.${type}` :
        parentGenerator ? `${parentGenerator.relativeDest}.${type}` : this.relativeDest;
    this.normalized = this.relativePath;
    this.builder = builder;

    this.ctx = new ModuleContextWithoutFS( builder.options, this );

    this.parentInner = parentInner;
    this.parentGenerator = parentGenerator;

    this.load = new Computation( ( c, b ) => this._load( c, b ) );
    this.pipeline = new Computation( ( c, b ) => this._pipeline( c, b ) );
    this.resolveDeps = new Computation( ( c, b ) => this._resolveDeps( c, b ) );

    this.buildId = 0;
    this.lastChangeId = 0;

    this.locOffset = loc;
    this.originalData = null;
    this.originalMap = null;
    this.wasParsed = false;
    this.checker = new Checker( this, builder );
    this.hashId = id;
    // this.hashId - Refill later if necessary
    // this.loadResult - Fill later
    // this.transformResult - Fill later
    // this.depsInfo - Fill later
    // this.deps - Fill later
  }

  unref() {
    this.load.invalidate();
    this.pipeline.invalidate();
    this.resolveDeps.invalidate();
  }

  moduleError( message: string ) {
    throw new Error( `${message}. Module: ${this.normalized}` );
  }

  error( message: string, loc: ?Loc ) {
    if ( this.wasParsed ) {

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
        code: originalData == null ? null : this.ctx.dataToString( originalData ),
        loc
      }, this.builder.options.codeFrameOptions );

    } else {

      error( message, {
        id: this.id,
        loc
      }, this.builder.options.codeFrameOptions );
    }
  }

  async _load( computation: ComputationApi, build: Build ): Promise<LoadOutput> {
    const ctx = new ModuleContext( this.builder.options, this );

    this.lastChangeId = this.buildId;

    try {

      let data, map;

      const parentInner = this.parentInner;
      const innerId = this.innerId;

      // For inline dependency module
      if ( parentInner ) {

        if ( !innerId ) {
          throw new Error( `Internal: missing innerId - ${this.id}` );
        }

        const { depsInfo: parentDeps } = await computation.get( parentInner.pipeline, build );
        const result = parentDeps.innerDependencies.get( innerId );

        if ( !result ) {
          throw new Error( `Internal: Could not get inner dependency content - ${this.id}` );
        }

        if ( this.builder.options.optimization.sourceMaps ) {
          const parentLoad = await computation.get( parentInner.load, build );
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
          const { content: parentTransform } = await computation.get( parentGenerator.pipeline, build );
          const result = await this.builder.pluginsRunner.transformType(
            parentTransform,
            ctx,
            parentGenerator.ctx
          );

          if ( this.builder.options.optimization.sourceMaps ) {
            const parentLoad = await computation.get( parentGenerator.load, build );
            data = result.data;
            map = joinSourceMaps( [ parentLoad.map, result.map ] );
          } else {
            data = result.data;
          }

          this.locOffset = parentGenerator.locOffset;

        // Original module from disk
        } else {
          data = await this.builder.pluginsRunner.load( this.path, ctx );
        }
      }

      this.originalData = data;
      this.originalMap = map;

      return ( this.loadResult = {
        data,
        map
      } );
    } catch ( err ) {
      if ( err.code === "ENOENT" ) {
        throw error( `Could not find ${this.normalized}` );
      }
      throw err;
    } finally {
      this.builder.registerFiles( ctx.files, computation );
    }
  }

  async _pipeline( computation: ComputationApi, build: Build ): Promise<PipelineResult> {

    const { data } = await computation.get( this.load, build );

    this.lastChangeId = this.buildId;

    const ctx = new ModuleContext( this.builder.options, this );

    const { depsInfo, content, files } = await this.builder.worker.pipeline( data, ctx );

    this.builder.registerFiles( files, computation );

    this.wasParsed = !!content.ast;

    this.transformResult = content;
    this.depsInfo = depsInfo;
    return {
      depsInfo,
      content
    };
  }

  async _handleDep(
    request: string,
    { loc, async }: NotResolvedDep,
    computation: ComputationApi,
    build: Build
  ): Promise<ModuleDep> {
    const path = await computation.newComputation(
      request,
      computation => resolve( this, request, loc, computation ),
      build
    );

    const required = build.addModuleAndTransform( {
      builder: this.builder,
      prevId: null,
      path,
      type: this.builder.pluginsRunner.getType( path )
    }, this );

    let splitPoint = this.builder.pluginsRunner.isSplitPoint( this.ctx, required.ctx );

    if ( splitPoint == null ) {
      splitPoint = !!async || required.type !== this.type;
    }

    return {
      path,
      request,
      loc,
      async,
      splitPoint,
      required,
      inherit: false
    };
  }

  async _resolveDeps( computation: ComputationApi, build: Build ): Promise<Map<string, ModuleDep>> {

    const moduleDeps = new Map();
    const { depsInfo } = await computation.get( this.pipeline, build );

    this.lastChangeId = this.buildId;

    const parent = this.parentGenerator;
    const parentModuleDeps = parent ? await computation.get( parent.resolveDeps, build ) : new Map();

    const p = [];
    for ( const [ request, dep ] of depsInfo.dependencies ) {
      if ( !parentModuleDeps.has( request ) ) {
        p.push( this._handleDep( request, dep || {}, computation, build ) );
      }
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
        prevId: this.id,
        path,
        type,
        loc,
        innerId,
        parentInner: this
      }, this );

      let splitPoint = this.builder.pluginsRunner.isSplitPoint( this.ctx, required.ctx );

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

    // Handle normal dependencies
    for ( const dep of await Promise.all( p ) ) {
      moduleDeps.set( dep.request, dep );
    }

    this.deps = moduleDeps;
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
      prevId: this.id,
      path: this.path,
      type: newType,
      loc: this.locOffset,
      parentGenerator: this
    } );
  }

  getLoadResult(): LoadOutput {
    return this.loadResult;
  }

  getTransformResult(): TransformOutput {
    return this.transformResult;
  }

  getModuleByRequest( request: string ): Module {
    // $FlowIgnore
    return this.deps.get( request ).required;
  }

  getImportedNames() {
    return this.depsInfo.importedNames;
  }

  getExportedNames() {
    return this.depsInfo.exportedNames;
  }

}
