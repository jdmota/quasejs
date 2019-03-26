import _error from "../utils/error";
import { ModuleContext, BuilderContext } from "../plugins/context";
import { Graph } from "../graph";
import {
  Plugin, Data, LoadOutput, TransformOutput, WatchedFiles,
  PipelineResult, DepsInfo, FinalAsset, ProcessedGraph, ToWrite
} from "../types";
import jsPlugin from "./implementations/js";
import htmlPlugin from "./implementations/html";
import defaultPlugin from "./implementations/default";

const { getPlugins } = require( "@quase/get-plugins" );

const defaultPlugins = [ jsPlugin, htmlPlugin, defaultPlugin ];

const EMPTY_OBJ = Object.freeze( Object.create( null ) );

function isObject( obj: unknown ): obj is object {
  return typeof obj === "object" && obj != null;
}

function error( hook: keyof Plugin, expected: string, actual: string, name: string|null ) {
  _error(
    `'${hook}' expected ${expected}${actual ? ` but got ${actual}` : ""}${name ? ` on plugin ${name}` : ""}`,
    {}
  );
}

class ValidationError extends Error {
  __validation: boolean;
  constructor( message: string | string[] ) {
    super( Array.isArray( message ) ? message.join( "\n" ) : message );
    this.name = "ValidationError";
    this.__validation = true;
  }
}

export interface PluginsRunnerInWorker {
  pipeline( data: Data, ctx: ModuleContext ): Promise<PipelineResult & {files: WatchedFiles}>;
}

export class PluginsRunner {

  optimization: any;
  plugins: { name: string|null; plugin: Plugin }[] = [];

  static workerMethods: "pipeline"[] = [ "pipeline" ];

  async init( options: { cwd: string; optimization: any; plugins: any } ) {
    this.optimization = options.optimization;
    this.plugins = getPlugins(
      options.plugins.concat( defaultPlugins ),
      options.cwd
    ).map(
      ( { name, plugin, options }: any ) => {
        if ( typeof plugin !== "function" ) {
          throw new ValidationError(
            `Expected ${name ? name + " " : ""}plugin to be a function instead got ${typeof plugin}`
          );
        }
        const p = plugin( options );
        if ( !isObject( p ) ) {
          throw new ValidationError(
            `Expected ${name ? name + " " : ""}plugin function to return an object not ${p == null ? p : typeof p}`
          );
        }
        return {
          name: p.name || name,
          plugin: p
        };
      }
    );

    const pluginsMap = new Map();
    for ( const plugin of this.plugins ) {
      if ( !pluginsMap.has( plugin.name ) ) {
        pluginsMap.set( plugin.name, plugin );
      }
    }
    this.plugins = Array.from( pluginsMap.values() );
  }

  validateGetType( actual: unknown, name: string|null ): string {
    if ( typeof actual !== "string" ) {
      throw error( "getType", "string", typeof actual, name );
    }
    const result = actual.trim();
    if ( result.length === 0 ) {
      throw error( "getType", "valid string", JSON.stringify( actual ), name );
    }
    return result;
  }

  getType( path: string ): string {
    for ( const { name, plugin } of this.plugins ) {
      const fn = plugin.getType;
      if ( fn ) {
        const result = fn( path );
        if ( result != null ) {
          return this.validateGetType( result, name );
        }
      }
    }
    throw new Error( `Unable to get type of ${path}` );
  }

  validateGetTypeTransforms( actual: any, name: string|null ): ReadonlyArray<string> {
    if ( !Array.isArray( actual ) ) {
      throw error( "getTypeTransforms", "array", typeof actual, name );
    }
    return actual;
  }

  getTypeTransforms( a: ModuleContext, b: ModuleContext|null ): ReadonlyArray<string> {
    for ( const { name, plugin } of this.plugins ) {
      const fn = plugin.getTypeTransforms;
      if ( fn ) {
        const result = fn( a, b );
        if ( result != null ) {
          return this.validateGetTypeTransforms( result, name );
        }
      }
    }
    return [];
  }

  validateLoad( actual: any, name: string|null ): any {
    if ( typeof actual === "string" || actual instanceof Uint8Array || Buffer.isBuffer( actual ) ) {
      return actual;
    }
    throw error( "load", "string | Buffer | Uint8Array", typeof actual, name );
  }

  async load( path: string, module: ModuleContext ): Promise<Data> {
    for ( const { name, plugin } of this.plugins ) {
      const fn = plugin.load;
      if ( fn ) {
        const result = await fn( path, module );
        if ( result != null ) {
          return this.validateLoad( result, name );
        }
      }
    }
    throw new Error( `Unable to load ${path}` );
  }

  async pipeline( data: Data, ctx: ModuleContext ): Promise<PipelineResult & {files: WatchedFiles}> {

    const ast = await this.parse( data, ctx );

    let content, finalAst, finalBuffer;

    if ( ast ) {
      finalAst = await this.transformAst( ast, ctx );
      content = {
        ast: finalAst,
        buffer: null
      };
    } else {
      if ( typeof data === "string" ) {
        throw new Error( "Internal: expected buffer" );
      }

      finalBuffer = await this.transformBuffer( data, ctx );
      content = {
        ast: null,
        buffer: finalBuffer
      };
    }

    const depsInfo = await this.dependencies( content, ctx );

    return {
      depsInfo,
      content,
      files: ctx.files
    };
  }

  validateParse( actual: any, name: string|null ): any {
    if ( !isObject( actual ) ) {
      throw error( "parse", "object", typeof actual, name );
    }
    return actual;
  }

  async parse( data: Data, module: ModuleContext ): Promise<object|null> {
    const wasString = typeof data === "string";
    let string = null;
    for ( const { name, plugin } of this.plugins ) {
      const map = plugin.parse || EMPTY_OBJ;
      const fn = map[ module.type ];
      if ( fn ) {
        if ( string == null ) {
          string = module.dataToString( data );
        }
        const res = await fn( string, module );
        if ( res != null ) {
          return this.validateParse( res, name );
        }
      }
    }
    if ( wasString ) {
      throw _error( `'parse' should return an AST since the 'load' phase returned a string for module type ${module.type}`, {} );
    }
    return null;
  }

  validateTransformAst( actual: any, name: string|null ): any {
    if ( !isObject( actual ) ) {
      throw error( "transformAst", "object", typeof actual, name );
    }
    return actual;
  }

  async transformAst( ast: any, module: ModuleContext ): Promise<any> {
    let result = ast;
    for ( const { name, plugin } of this.plugins ) {
      const map = plugin.transformAst || EMPTY_OBJ;
      const fn = map[ module.type ];
      if ( fn ) {
        const res = await fn( result, module );
        if ( res != null ) {
          result = this.validateTransformAst( res, name );
        }
      }
    }
    return result;
  }

  validateTransformBuffer( actual: any, name: string|null ): any {
    if ( actual instanceof Uint8Array || Buffer.isBuffer( actual ) ) {
      return actual;
    }
    throw error( "transformBuffer", "Buffer | Uint8Array", typeof actual, name );
  }

  async transformBuffer( buffer: Buffer | Uint8Array, module: ModuleContext ): Promise<Buffer | Uint8Array> {
    let result = buffer;
    for ( const { name, plugin } of this.plugins ) {
      const map = plugin.transformAst || EMPTY_OBJ;
      const fn = map[ module.type ];
      if ( fn ) {
        const res = await fn( buffer, module );
        if ( res != null ) {
          result = this.validateTransformBuffer( res, name );
        }
      }
    }
    return result;
  }

  validateDependencies( actual: any, name: string|null ): any {
    if ( !isObject( actual ) ) {
      throw error( "dependencies", "object", typeof actual, name );
    }
    return {
      dependencies: actual.dependencies || new Map(),
      innerDependencies: actual.innerDependencies || new Map(),
      importedNames: actual.importedNames || [],
      exportedNames: actual.exportedNames || []
    };
  }

  async dependencies( output: TransformOutput, module: ModuleContext ): Promise<DepsInfo> {
    if ( output.ast != null ) {
      for ( const { name, plugin } of this.plugins ) {
        const map = plugin.dependencies || EMPTY_OBJ;
        const fn = map[ module.type ];
        if ( fn ) {
          const result = await fn( output.ast, module );
          if ( result != null ) {
            return this.validateDependencies( result, name );
          }
        }
      }
    }
    return {
      dependencies: new Map(),
      innerDependencies: new Map(),
      importedNames: [],
      exportedNames: []
    };
  }

  validateResolve( actual: any, name: string|null ): string | false {
    if ( actual === true ) {
      throw error( "resolve", "string | false", "true", name );
    }
    if ( typeof actual !== "string" && actual !== false ) {
      throw error( "resolve", "string | false", typeof actual, name );
    }
    return actual;
  }

  async resolve( imported: string, module: ModuleContext ): Promise<string | false> {
    for ( const { name, plugin } of this.plugins ) {
      const map = plugin.resolve || EMPTY_OBJ;
      const fn = map[ module.type ] || map[ "*" ];
      if ( fn ) {
        const result = await fn( imported, module );
        if ( result != null ) {
          return this.validateResolve( result, name );
        }
      }
    }
    return false;
  }

  validateTransformType( actual: any, name: string|null ): any {
    if ( !isObject( actual ) ) {
      throw error( "transformType", "object", typeof actual, name );
    }
    return actual;
  }

  async transformType( output: TransformOutput, module: ModuleContext, parent: ModuleContext ): Promise<LoadOutput> {
    const newType = module.type;
    for ( const { name, plugin } of this.plugins ) {
      const map = plugin.transformType || EMPTY_OBJ;
      const fromType = map[ parent.type ] || EMPTY_OBJ;
      const fn = fromType[ newType ];
      if ( fn ) {
        const result = await fn( output, module );
        if ( result != null ) {
          return this.validateTransformType( result, name );
        }
      }
    }
    throw new Error(
      `Unable to transform ${module.normalized} from ${parent.type} to ${newType}.`
    );
  }

  validateIsSplitPoint( actual: unknown, name: string|null ): boolean {
    if ( typeof actual !== "boolean" ) {
      throw error( "isSplitPoint", "boolean", typeof actual, name );
    }
    return actual;
  }

  isSplitPoint( a: ModuleContext, b: ModuleContext ): boolean|null {
    for ( const { name, plugin } of this.plugins ) {
      const fn = plugin.isSplitPoint;
      if ( fn ) {
        const result = fn( a, b );
        if ( result != null ) {
          return this.validateIsSplitPoint( result, name );
        }
      }
    }
    return null;
  }

  validateIsExternal( actual: unknown, name: string|null ): boolean {
    if ( typeof actual !== "boolean" ) {
      throw error( "isExternal", "boolean", typeof actual, name );
    }
    return actual;
  }

  async isExternal( thing: string ): Promise<boolean> {
    for ( const { name, plugin } of this.plugins ) {
      const fn = plugin.isExternal;
      if ( fn ) {
        const result = await fn( thing );
        if ( result != null ) {
          return this.validateIsExternal( result, name );
        }
      }
    }
    return false;
  }

  async check( graph: Graph ): Promise<void> {
    for ( const { plugin } of this.plugins ) {
      const fn = plugin.check;
      if ( fn ) {
        await fn( graph );
      }
    }
  }

  validateGraphTransform( actual: any, name: string|null ): any {
    if ( !isObject( actual ) ) {
      throw error( "graphTransform", "object", typeof actual, name );
    }
    return actual;
  }

  async graphTransform( initial: ProcessedGraph ): Promise<ProcessedGraph> {
    let result = initial;
    for ( const { name, plugin } of this.plugins ) {
      const fn = plugin.graphTransform;
      if ( fn ) {
        const res = await fn( result );
        if ( res != null ) {
          result = this.validateGraphTransform( res, name );
        }
      }
    }
    return result;
  }

  validateRenderAsset( actual: any, name: string|null ): any {
    if ( !isObject( actual ) ) {
      throw error( "renderAsset", "object", typeof actual, name );
    }
    if ( this.optimization.sourceMaps ) {
      return {
        data: actual.data,
        map: actual.map
      };
    }
    return {
      data: actual.data,
      map: null
    };
  }

  async renderAsset( asset: FinalAsset, ctx: BuilderContext ): Promise<ToWrite> {
    const inlines = new Map();

    await Promise.all( asset.inlineAssets.map( async a => {
      const toWrite = await this.renderAsset( a, ctx );
      inlines.set( a, toWrite );
    } ) );

    for ( const { name, plugin } of this.plugins ) {
      const map = plugin.renderAsset || EMPTY_OBJ;
      const fn = map[ asset.type ];
      if ( fn ) {
        const result = await fn( asset, inlines, ctx );
        if ( result != null ) {
          return this.validateRenderAsset( result, name );
        }
      }
    }

    if ( asset.srcs.size !== 1 ) {
      throw new Error( `Asset "${asset.id}" has more than 1 source. Probably there is some plugin missing.` );
    }

    const { buffer } = asset.module.getTransformResult();

    if ( buffer ) {
      return {
        data: buffer,
        map: null
      };
    }

    throw new Error( `Asset "${asset.id}" could not be rendered. Probably there is some plugin missing.` );
  }

}
