import { isAbsolute, lowerPath } from "../utils/path";
import { ComputationGet, Computation } from "../utils/computation";
import { Loc, Dep, ResolvedDep, Transforms, TransformableAsset } from "../types";
import { Builder } from "../builder/builder";
import { ModuleContext } from "../plugins/context";

export type ModuleArg = Readonly<{
  innerId: null;
  parentInner: null;
  parentGenerator: null;
  transforms: ReadonlyArray<string>;
  path: string;
}> | Readonly<{
  // This module is inside other module
  innerId: string;
  parentInner: Module;
  parentGenerator: null;
  transforms: ReadonlyArray<string>;
  path: string;
}> | Readonly<{
  // This module was transformed from other module
  innerId: null;
  parentInner: null;
  parentGenerator: Module;
  transforms: ReadonlyArray<string>;
  path: string;
}>;

export type Module = Readonly<{
  // Unique id
  id: string;
  // Absolute file path
  path: string;
  // Relative file path (to context)
  relativePath: string;
  // Context
  ctx: ModuleContext;

  pipeline: Computation<Processed1>;
  resolveDeps: Computation<Processed2>;
} & ModuleArg>;

export type ModuleInfo = Readonly<{
  id: string;
  path: string;
  relativePath: string;
  transforms: ReadonlyArray<string>;
}>;

type Processed1 = {
  transformedBuildId: number;
  asset: TransformableAsset;
};

type Processed2 = {
  transformedBuildId: number;
  asset: TransformableAsset;
  resolvedBuildId: number;
  resolvedDeps: ResolvedDep[];
};

export class ModuleContextWithoutFS extends ModuleContext {

  registerFile( _: string, _2: { onlyExistance?: boolean } = {} ) {
    throw new Error( "File system operations are not possible with this context" );
  }

}

export function moduleError( builder: Builder, module: { id: string }, message: string, loc: Loc | null ) {
  // TODO code?
  builder.error( module.id, message, null, loc );
}

export async function pipeline(
  builder: Builder, module: Module, getter: ComputationGet, buildId: number
): Promise<Processed1> {

  let asset: TransformableAsset | null;

  // For inline dependency module
  if ( module.parentInner ) {

    const { asset: { depsInfo: parentDeps } } = await getter( module.parentInner.pipeline );
    const result = parentDeps && parentDeps.innerDependencies ? parentDeps.innerDependencies.get( module.innerId ) : undefined;

    if ( !result ) {
      throw new Error( `Internal: Could not get inner dependency content` );
    }

    if ( builder.options.optimization.sourceMaps ) {
      // TODO
      asset = {
        type: result.type,
        data: result.data,
        ast: null,
        map: null,
        depsInfo: null,
        meta: null
      };
    } else {
      asset = {
        type: result.type,
        data: result.data,
        ast: null,
        map: null,
        depsInfo: null,
        meta: null
      };
    }

  // For modules generated from other module
  } else if ( module.parentGenerator ) {
    asset = ( await getter( module.parentGenerator.pipeline ) ).asset;

  // Original module from disk
  } else {
    asset = null;
  }

  const { result, files } = await builder.pluginsRunner.pipeline( asset, module.ctx );
  builder.registerFiles( files, getter );

  return {
    transformedBuildId: buildId,
    asset: result
  };
}

async function resolve(
  builder: Builder, module: Module, getter: ComputationGet,
  buildId: number, request: string, dep: Dep
): Promise<ResolvedDep> {
  const ctx = new ModuleContext( builder.options, module );
  const loc = dep.loc || null;

  if ( !request ) {
    throw moduleError( builder, module, "Empty import", loc );
  }

  let res: { path: string; transforms?: Transforms } | false;

  try {
    res = await builder.pluginsRunner.resolve( request, ctx );
  } finally {
    // Register before sending an error
    builder.registerFiles( ctx.files, getter );
  }

  if ( !res ) {
    throw moduleError( builder, module, `Could not resolve ${request}`, loc );
  }

  let path = res.path;

  if ( !isAbsolute( path ) ) {
    throw moduleError( builder, module, `Resolution returned a non absolute path: ${path}`, loc );
  }

  path = lowerPath( path );

  if ( path === module.path ) {
    throw moduleError( builder, module, "A module cannot import itself", loc );
  }

  if ( builder.util.isDest( path ) ) {
    throw moduleError( builder, module, "Don't import the destination file", loc );
  }

  const resolved = {
    request,
    path,
    async: !!dep.async,
    transforms: dep.transforms || res.transforms || builder.userConfig.getTransformationsForPath( path )
  };
  builder.notifyAddModule( buildId, resolved.path, resolved.transforms );
  return resolved;
}

export async function resolveDeps(
  builder: Builder, module: Module, getter: ComputationGet, buildId: number
): Promise<Processed2> {

  const { transformedBuildId, asset } = await getter( module.pipeline );

  const { depsInfo } = asset;
  const jobs: Promise<ResolvedDep>[] = [];

  if ( depsInfo && depsInfo.dependencies ) {
    for ( const [ request, dep ] of depsInfo.dependencies ) {
      jobs.push( resolve( builder, module, getter, buildId, request, dep ) );
    }
  }

  if ( depsInfo && depsInfo.innerDependencies ) {
    for ( const [ innerId, innerDep ] of depsInfo.innerDependencies ) {
      builder.notifyAddInnerModule(
        buildId, innerId, module,
        innerDep.transforms || builder.userConfig.getTransformationsForType( innerDep.type )
      );
    }
  }

  return {
    transformedBuildId,
    asset,
    resolvedBuildId: buildId,
    resolvedDeps: await Promise.all( jobs )
  };
}
