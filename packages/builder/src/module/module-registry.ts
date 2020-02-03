import { relative } from "../utils/path";
import { Builder } from "../builder/builder";
import { Module, ModuleArg } from "./module";
import { ModuleContext } from "../plugins/context";
import { PipelineComputation } from "./pipeline-computation";
import { ResolveComputation } from "./resolve-computation";
import { ComputationRegistry } from "../utils/computation-registry";

const EMPTY_SET: ReadonlySet<Module> = new Set();
const ANY: any = null;

export class ModuleRegistry {
  private builder: Builder;
  private map: Map<string, Module>;
  private byFile: Map<string, Set<Module>>;
  private computationRegistry: ComputationRegistry;
  private notMarked: Set<Module>;

  constructor(builder: Builder, computationRegistry: ComputationRegistry) {
    this.builder = builder;
    this.map = new Map();
    this.byFile = new Map();
    this.computationRegistry = computationRegistry;
    this.notMarked = new Set();
  }

  resetMarks() {
    this.notMarked = new Set(this);
  }

  toDelete(): ReadonlySet<Module> {
    return this.notMarked;
  }

  getAndMark(id: string) {
    const m = this.get(id);
    this.notMarked.delete(m);

    let parent = m.parentGenerator;
    while (parent && this.notMarked.has(parent)) {
      this.notMarked.delete(parent);
      parent = parent.parentGenerator;
    }

    return m.resolveDeps.peekValue();
  }

  get(id: string): Module {
    const thing = this.map.get(id);
    if (thing) {
      return thing;
    }
    throw new Error(`Assertion error: ${id} does not exist`);
  }

  getByFile(path: string): ReadonlySet<Module> {
    return this.byFile.get(path) || EMPTY_SET;
  }

  add(arg: ModuleArg) {
    const id = this.makeId(arg);
    let module = this.map.get(id);
    if (module) {
      return module;
    }

    module = this.factory(arg, id);
    this.map.set(id, module);

    const set = this.byFile.get(arg.path) || new Set();
    this.byFile.set(arg.path, set);
    set.add(module);

    return module;
  }

  remove(m: Module) {
    this.map.delete(m.id);

    const set = this.byFile.get(m.path);
    set!.delete(m); // eslint-disable-line @typescript-eslint/no-non-null-assertion

    m.pipeline.destroy();
    m.resolveDeps.destroy();
  }

  [Symbol.iterator]() {
    return this.map.values();
  }

  private transformsToStr(t: readonly string[]) {
    return t.length === 0 ? "" : `[${t.toString()}]`;
  }

  makeId(arg: ModuleArg) {
    if (arg.parentInner) {
      return `${arg.parentInner.id}(${arg.innerId})${this.transformsToStr(
        arg.transforms
      )}`;
    }
    if (arg.parentGenerator) {
      return `${arg.parentGenerator.id}${this.transformsToStr(arg.transforms)}`;
    }
    const p = relative(arg.path, this.builder.context);
    return `${p}${this.transformsToStr(arg.transforms)}`;
  }

  factory(arg: ModuleArg, id: string): Module {
    const relativePath = relative(arg.path, this.builder.context);

    const module: Module = {
      ...arg,
      id,
      path: arg.path,
      relativePath,
      ctx: new ModuleContext(this.builder.options, {
        id,
        path: arg.path,
        relativePath,
        transforms: arg.transforms,
      }),
      builder: this.builder,
      pipeline: ANY,
      resolveDeps: ANY,
    };

    module.pipeline = new PipelineComputation(this.computationRegistry, module);
    module.resolveDeps = new ResolveComputation(
      this.computationRegistry,
      module
    );

    return module;
  }
}
