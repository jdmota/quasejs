// @flow
import type { Loc, Data, LoadOutput, TransformOutput, DepsInfo, ModuleDep, PublicModuleDep } from "../types";
import { Checker } from "../checker";
import Module from "./index";

export default class PublicModule {

  +_module: Module;
  +id: string;
  +path: string;
  +type: string;
  +innerId: ?string;
  +relative: string;
  +dest: string;
  +normalized: string;
  +originalData: ?Data;
  +checker: Checker;
  +load: Promise<LoadOutput>;
  +transform: Promise<TransformOutput>;
  +getDeps: Promise<DepsInfo>;
  +resolveDeps: Promise<Map<string, ModuleDep>>;
  +deps: Map<string, PublicModuleDep>;
  hashId: string;
  loadResult: LoadOutput;
  transformResult: TransformOutput;
  depsInfo: DepsInfo;

  constructor( m: Module ) {
    this._module = m;
    this.id = m.id;
    this.path = m.path;
    this.type = m.type;
    this.innerId = m.innerId;
    this.relative = m.relative;
    this.dest = m.dest;
    this.normalized = m.normalized;
    this.originalData = m.originalData;
    this.checker = new Checker( this, m.builder );
    this.load = m.load.get();
    this.transform = m.transform.get();
    this.getDeps = m.getDeps.get();
    this.resolveDeps = m.resolveDeps.get();
    this.deps = new Map(); // Fill later
    // this.hashId - Fill later
    // this.loadResult - Fill later
    // this.transformResult - Fill later
    // this.depsInfo - Fill later
  }

  error( message: string, loc: ?Loc ) {
    this._module.error( message, loc );
  }

  getLoadResult(): LoadOutput {
    return this.loadResult;
  }

  getTransformResult(): TransformOutput {
    return this.transformResult;
  }

  getModuleByRequest( request: string ): PublicModule {
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
