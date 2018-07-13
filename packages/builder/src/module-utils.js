// @flow
import type Builder from "./builder";
import type Module from "./module";
import { type FSOperation } from "./filesystem";

export type RequirerInfo = {
  who: Module,
  when: string,
  what: FSOperation
};

export default class ModuleUtils {

  +_builder: Builder;
  +_module: Module;
  +id: string;
  +hashId: string;
  +path: string;
  +normalized: string;
  +type: string;
  +index: number;
  _statInfo: RequirerInfo;
  _readFileInfo: RequirerInfo;
  _cache: Map<any, any>;

  constructor( module: Module, builder: Builder ) {
    this._builder = builder;
    this._module = module;
    this.id = module.id;
    this.hashId = module.hashId;
    this.path = module.path;
    this.normalized = module.normalized;
    this.type = module.type;
    this.index = module.index;
    this._statInfo = { who: this._module, when: "", what: "stat" };
    this._readFileInfo = { who: this._module, when: "", what: "readFile" };
    this._cache = new Map();
  }

  _hook( when: string ) {
    this._statInfo = { who: this._module, when, what: "stat" };
    this._readFileInfo = { who: this._module, when, what: "readFile" };
  }

  builderOptions() {
    return this._builder.options;
  }

  createFakePath( key: string ): string {
    return this._builder.createFakePath( key );
  }

  isFakePath( path: string ): boolean {
    return this._builder.isFakePath( path );
  }

  getModuleByRequest( request: string ): ?ModuleUtils {
    const m = this._module.getModuleByRequest( request );
    return m && m.utils;
  }

  async getResult() {
    const { result } = await this._module.transform( this._builder );
    return result;
  }

  async stat( file: string ) {
    return this._builder.fileSystem.stat( file, this._statInfo );
  }

  async isFile( file: string ) {
    return this._builder.fileSystem.isFile( file, this._statInfo );
  }

  async readFile( file: string, enconding: ?string ) {
    return this._builder.fileSystem.readFile( file, this._readFileInfo, enconding );
  }

  cacheGet( key: any ): any {
    return this._cache.get( key );
  }

  cacheSet( key: any, value: any ): any {
    return this._cache.set( key, value );
  }

  cacheDelete( key: any ): boolean {
    return this._cache.delete( key );
  }

}
