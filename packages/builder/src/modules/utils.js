// @flow
import { type ComputationApi } from "../utils/data-dependencies";
import type Builder from "../builder";
import type Module from "./index";

export class ModuleUtils {

  +_builder: Builder;
  +_module: Module;
  +id: string;
  +path: string;
  +relative: string;
  +normalized: string;
  +type: string;
  +innerId: ?string;

  constructor( module: Module ) {
    this._builder = module.builder;
    this._module = module;
    this.id = module.id;
    this.path = module.path;
    this.relative = module.relative;
    this.normalized = module.normalized;
    this.type = module.type;
    this.innerId = module.innerId;
  }

  builderOptions() {
    return this._builder.options;
  }

  isFakePath( path: string ): boolean {
    return this._builder.isFakePath( path );
  }

}

export class ModuleUtilsWithFS extends ModuleUtils {

  _computation: ComputationApi;

  constructor( module: Module, computation: ComputationApi ) {
    super( module );
    this._computation = computation;
  }

  createFakePath( key: string ): string {
    return this._builder.createFakePath( key );
  }

  async stat( file: string ) {
    return this._builder.fileSystem.stat( file, this._computation );
  }

  async isFile( file: string ) {
    return this._builder.fileSystem.isFile( file, this._computation );
  }

  async readFile( file: string, enconding: ?string ) {
    return this._builder.fileSystem.readFile( file, this._computation, enconding );
  }

}
