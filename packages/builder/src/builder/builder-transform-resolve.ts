import { Transforms, FinalModule, Options } from "../types";
import { computationInvalidate, computationGet, ComputationCancelled } from "../utils/computation";
import { Module, ModuleArg } from "../module/module";
import { ModuleRegistry } from "../module/module-registry";
import { Builder, Build } from "./builder";
import { UserConfig } from "./user-config";

export class BuilderTransformResolve {

  private builder: Builder;
  private options: Options;
  private userConfig: UserConfig;
  private registry: ModuleRegistry;

  constructor( builder: Builder ) {
    this.builder = builder;
    this.options = builder.options;
    this.userConfig = builder.userConfig;
    this.registry = new ModuleRegistry( this.builder );
  }

  private removeOrphans( build: Build ) {
    const removed = [];

    for ( const module of this.registry ) {
      if ( !build.graph.exists( module.id ) ) {
        removed.push( module );
      }
    }

    for ( const module of removed ) {
      for ( const checker of this.builder.actualCheckers ) {
        checker.deletedModule( module.id );
      }
      this.registry.remove( module );
      computationInvalidate( module.pipeline );
      computationInvalidate( module.resolveDeps );
    }
  }

  private async _process( build: Build, m: Module ) {
    const { transformedBuildId, resolvedBuildId, asset, resolvedDeps } = await computationGet( m.resolveDeps, build.id );

    const finalModule: FinalModule = {
      id: m.id,
      path: m.path,
      relativePath: m.relativePath,
      innerId: m.innerId,
      hashId: m.id,
      transformedBuildId,
      resolvedBuildId,
      asset,
      moduleIdByRequest: new Map(),
      innerModuleIdByRequest: new Map(),
      requires: []
    };

    for ( const resolved of resolvedDeps ) {
      const required = this.addModuleAndTransform( build, resolved.path, resolved.transforms );
      const resolvedWithId = {
        id: required.id,
        hashId: required.id,
        async: resolved.async
      };
      finalModule.moduleIdByRequest.set( resolved.request, resolvedWithId );
      finalModule.requires.push( resolvedWithId );
    }

    if ( asset.depsInfo && asset.depsInfo.innerDependencies ) {
      for ( const [ innerId, innerDep ] of asset.depsInfo.innerDependencies ) {
        const required = this.addInnerModuleAndTransform(
          build, innerId, m,
          innerDep.transforms || this.userConfig.getTransformationsForType( innerDep.type )
        );
        const resolvedWithId = {
          id: required.id,
          hashId: required.id,
          async: !!innerDep.async
        };
        finalModule.innerModuleIdByRequest.set( innerId, resolvedWithId );
        finalModule.requires.push( resolvedWithId );
      }
    }

    build.graph.add( finalModule );

    if ( resolvedBuildId === build.id ) {
      for ( const checker of this.builder.actualCheckers ) {
        checker.newModule( finalModule );
      }
    }
  }

  private addModule( build: Build, arg: ModuleArg ): Module {
    const m = this.registry.add( arg );
    if ( this.builder.build !== build ) return m;
    if ( build.pending.has( m.id ) ) return m;
    build.pending.add( m.id );
    build.promises.push( this._process( build, m ) );
    return m;
  }

  addModuleAndTransform(
    build: Build, path: string, transforms: Transforms
  ): Module {
    return this.applyTransforms(
      build,
      this.addModule( build, {
        innerId: null,
        parentInner: null,
        parentGenerator: null,
        transforms: transforms[ 0 ] || [],
        path
      } ),
      transforms.slice( 1 )
    );
  }

  addInnerModuleAndTransform(
    build: Build, innerId: string, parentInner: Module, transforms: Transforms
  ): Module {
    return this.applyTransforms(
      build,
      this.addModule( build, {
        innerId,
        parentInner,
        parentGenerator: null,
        transforms: transforms[ 0 ] || [],
        path: parentInner.path
      } ),
      transforms.slice( 1 )
    );
  }

  private applyTransforms( build: Build, original: Module, transforms: Transforms ): Module {
    let m = original;
    for ( const t of transforms ) {
      m = this.addModule( build, {
        innerId: null,
        parentInner: null,
        parentGenerator: m,
        transforms: t,
        path: m.path
      } );
    }
    return m;
  }

  private checkIfCancelled( build: Build ) {
    if ( this.builder.build !== build ) {
      throw new ComputationCancelled();
    }
  }

  private wait<T>( build: Build, p: Promise<T> ) {
    this.checkIfCancelled( build );
    return p;
  }

  async run( build: Build ) {

    for ( const path of this.options.entries ) {
      build.graph.markEntry(
        this.addModuleAndTransform( build, path, this.userConfig.getTransformationsForPath( path ) ).id
      );
    }

    let promise;
    while ( promise = build.promises.pop() ) {
      await this.wait( build, promise );
    }

    this.removeOrphans( build );

  }

}
