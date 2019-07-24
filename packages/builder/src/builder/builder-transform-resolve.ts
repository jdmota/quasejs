import path from "path";
import { Transforms, Options, WatchedFileInfo } from "../types";
import { Module } from "../module/module";
import { ModuleRegistry } from "../module/module-registry";
import { Builder } from "./builder";
import { UserConfig } from "./user-config";
import { Graph } from "./graph";
import { makeAbsolute } from "../utils/path";
import { ComputationRegistry, Computation } from "../utils/computation-registry";
import { FileComputation } from "./file-computation";

export class BuilderTransformResolve {

  private builder: Builder;
  private options: Options;
  private userConfig: UserConfig;
  private entries: { path: string; transforms: readonly ( readonly string[] )[] }[] | null;
  private registry: ModuleRegistry;
  private computationRegistry: ComputationRegistry;
  private computationsByFile: Map<string, {
    change: FileComputation | null;
    addOrRemove: FileComputation;
  }>;

  constructor( builder: Builder ) {
    this.builder = builder;
    this.options = builder.options;
    this.userConfig = builder.userConfig;
    this.entries = null;
    this.computationRegistry = new ComputationRegistry();
    this.registry = new ModuleRegistry( this.builder, this.computationRegistry );
    this.computationsByFile = new Map();
  }

  subscribeFile( _path: string, info: WatchedFileInfo, sub: Computation<any> ) {
    const path = makeAbsolute( _path );
    const subs = this.computationsByFile.get( path ) || {
      change: null,
      addOrRemove: new FileComputation( this.computationRegistry, path )
    };

    subs.addOrRemove.subscribe( sub );

    if ( !info.onlyExistance ) {
      if ( !subs.change ) {
        subs.change = new FileComputation( this.computationRegistry, path );
      }
      subs.change.subscribe( sub );
    }

    this.computationsByFile.set( path, subs );
  }

  private invalidateFile( what: string, existance: boolean ) {
    const computations = this.computationsByFile.get( what );
    if ( computations ) {
      if ( computations.change ) {
        computations.change.destroy();
        computations.change = null;
      }
      if ( existance ) {
        computations.addOrRemove.destroy();
        this.computationsByFile.delete( what );
        this.change( path.dirname( what ), "changed" );
      }
    }
  }

  change( _what: string, type: "added" | "changed" | "removed" ) {
    const what = makeAbsolute( _what );

    switch ( type ) {
      case "added":
        this.invalidateFile( what, true );
        break;
      case "removed":
        this.invalidateFile( what, true );
        for ( const module of this.registry.getByFile( what ) ) {
          this.removeModule( module );
        }
        break;
      default:
        this.invalidateFile( what, false );
    }
  }

  watchedFiles() {
    const set = new Set( this.computationsByFile.keys() );
    // Always watch entry files
    for ( const file of this.options.entries ) {
      set.add( file );
    }
    return set;
  }

  removeModuleById( id: string ) {
    const m = this.registry.get( id );
    this.removeModule( m );
  }

  private removeModule( module: Module ) {
    for ( const checker of this.builder.actualCheckers ) {
      checker.deletedModule( module.id );
    }
    this.registry.remove( module );
  }

  private removeOrphans() {
    for ( const module of this.registry.toDelete() ) {
      this.removeModule( module );
    }
  }

  addModule( path: string, transforms: Transforms ): Module {
    return this.applyTransforms(
      this.registry.add( {
        innerId: null,
        parentInner: null,
        parentGenerator: null,
        transforms: transforms[ 0 ] || [],
        path
      } ),
      transforms.slice( 1 )
    );
  }

  addInnerModule( innerId: string, parentInner: Module, transforms: Transforms ): Module {
    return this.applyTransforms(
      this.registry.add( {
        innerId,
        parentInner,
        parentGenerator: null,
        transforms: transforms[ 0 ] || [],
        path: parentInner.path
      } ),
      transforms.slice( 1 )
    );
  }

  private applyTransforms( original: Module, transforms: Transforms ): Module {
    let m = original;
    for ( const t of transforms ) {
      m = this.registry.add( {
        innerId: null,
        parentInner: null,
        parentGenerator: m,
        transforms: t,
        path: m.path
      } );
    }
    return m;
  }

  interrupt() {
    this.computationRegistry.interrupt();
  }

  getModule( id: string ) {
    return this.registry.get( id ).resolveDeps.peekValue();
  }

  async run() {

    const entries = this.entries || (
      this.entries = this.options.entries.map( path => ( {
        path,
        transforms: this.userConfig.getTransformationsForPath( path )
      } ) )
    );

    const moduleEntries = entries.map(
      ( { path, transforms } ) => this.addModule( path, transforms ).id
    );

    const errors = await this.computationRegistry.run();

    if ( this.computationRegistry.wasInterrupted() ) {
      return {
        graph: null,
        errors: null
      };
    }

    if ( errors.length > 0 ) {
      return {
        graph: null,
        errors
      };
    }

    this.registry.resetMarks();

    const g = new Graph(
      this.userConfig,
      this.registry,
      moduleEntries
    );

    this.removeOrphans();

    return {
      graph: g,
      errors: null
    };
  }

}
