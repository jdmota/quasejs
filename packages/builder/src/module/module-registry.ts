import { relative } from "../utils/path";
import { Builder } from "../builder/builder";
import { Module, pipeline, resolveDeps, ModuleArg } from "./module";
import { createComputation } from "../utils/computation";
import { ModuleContext } from "../plugins/context";

export class ModuleRegistry {

  private builder: Builder;
  private map: Map<string, Module>;

  constructor( builder: Builder ) {
    this.builder = builder;
    this.map = new Map();
  }

  /* exists( id: string ): boolean {
    return this.map.has( id );
  }

  get( id: string ): Module {
    const thing = this.map.get( id );
    if ( thing ) {
      return thing;
    }
    throw new Error( `Assertion error: ${id} does not exist` );
  } */

  add( arg: ModuleArg ) {
    const id = this.makeId( arg );
    let thing = this.map.get( id );
    if ( thing ) {
      return thing;
    }
    thing = this.factory( arg, id );
    this.map.set( id, thing );
    return thing;
  }

  remove( m: Module ) {
    this.map.delete( m.id );
  }

  [Symbol.iterator]() {
    return this.map.values();
  }

  private transformsToStr( t: ReadonlyArray<string> ) {
    return t.length === 0 ? "" : `[${t.toString()}]`;
  }

  makeId( arg: ModuleArg ) {
    if ( arg.parentInner ) {
      return `${arg.parentInner.id}(${arg.innerId})${this.transformsToStr( arg.transforms )}`;
    }
    if ( arg.parentGenerator ) {
      return `${arg.parentGenerator.id}${this.transformsToStr( arg.transforms )}`;
    }
    const p = relative( arg.path, this.builder.context );
    return `${p}${this.transformsToStr( arg.transforms )}`;
  }

  factory( arg: ModuleArg, id: string ): Module {
    const relativePath = relative( arg.path, this.builder.context );

    const module: Module = {
      ...arg,
      id,
      path: arg.path,
      relativePath,
      ctx: new ModuleContext( this.builder.options, {
        id,
        path: arg.path,
        relativePath,
        transforms: arg.transforms
      } ),
      pipeline: createComputation(
        ( getter, buildId ) => pipeline( this.builder, module, getter, buildId )
      ),
      resolveDeps: createComputation(
        ( getter, buildId ) => resolveDeps( this.builder, module, getter, buildId )
      )
    };

    return module;
  }

}
