import { Builder } from "../builder/builder";
import { Module } from "./module";
import {
  ComputationRegistry,
  Computation,
  CValue,
} from "../utils/computation-registry";
import {
  ResolvedDep,
  Dep,
  Transforms,
  FinalModule,
  ResolvedInnerDep,
  Loc,
  TransformableAsset,
} from "../types";
import { ModuleContext } from "../plugins/context";
import { lowerPath, isAbsolute } from "../utils/path";
import { deserialize } from "../utils/serialization";

/* eslint-disable @typescript-eslint/no-non-null-assertion */

class SingleResolveComputation extends Computation<ResolvedDep> {
  private readonly module: Module;
  private readonly builder: Builder;
  private readonly request: string;
  private readonly dep: Dep;

  constructor(
    registry: ComputationRegistry,
    module: Module,
    request: string,
    dep: Dep
  ) {
    super(registry);
    this.module = module;
    this.builder = module.builder;
    this.request = request;
    this.dep = dep;
  }

  private retError(message: string, loc: Loc | null) {
    // TODO code?
    return [
      null,
      this.builder.createError(this.module.id, message, null, loc),
    ] as const;
  }

  protected async run(
    _: ResolvedDep | null,
    isRunning: () => void
  ): Promise<CValue<ResolvedDep>> {
    const { request, dep } = this;
    const ctx = new ModuleContext(this.builder.options, this.module);
    const loc = dep.loc || null;

    if (!request) {
      return this.retError("Empty import", loc);
    }

    let res: { path: string; transforms?: Transforms } | false;

    try {
      res = await this.builder.pluginsRunner.resolve(request, ctx);
      isRunning();

      this.builder.subscribeFiles(ctx.files, this);
    } catch (error) {
      return [null, error];
    }

    if (!res) {
      return this.retError(`Could not resolve ${request}`, loc);
    }

    let path = res.path;

    if (!isAbsolute(path)) {
      return this.retError(
        `Resolution returned a non absolute path: ${path}`,
        loc
      );
    }

    path = lowerPath(path);

    if (path === this.module.path) {
      return this.retError("A module cannot import itself", loc);
    }

    if (ctx.isDest(path)) {
      return this.retError("Don't import the destination file", loc);
    }

    const resolved = {
      id: "",
      request,
      path,
      async: !!dep.async,
      transforms:
        dep.transforms ||
        res.transforms ||
        this.builder.userConfig.getTransformationsForPath(path),
    };

    resolved.id = this.builder.addModule(resolved.path, resolved.transforms);

    return [resolved, null];
  }
}

const EMPTY_SET: ReadonlySet<string> = new Set();

export class ResolveComputation extends Computation<FinalModule> {
  private module: Module;
  private builder: Builder;
  private resolutions: Map<string, SingleResolveComputation>;
  private innerDeps: Set<string>;
  private id: number;

  constructor(registry: ComputationRegistry, module: Module) {
    super(registry);
    this.module = module;
    this.builder = module.builder;
    this.resolutions = new Map();
    this.innerDeps = new Set();
    this.id = 0;
  }

  destroy() {
    this.cleanResolutions(EMPTY_SET);
    this.cleanInnerDeps(EMPTY_SET);
    super.destroy();
  }

  private cleanResolutions(requests: ReadonlySet<string>) {
    for (const request of this.resolutions.keys()) {
      if (!requests.has(request)) {
        const r = this.resolutions.get(request)!;
        r.destroy();
        this.resolutions.delete(request);
      }
    }
  }

  private cleanInnerDeps(innerDeps: ReadonlySet<string>) {
    for (const id of this.innerDeps) {
      if (!innerDeps.has(id)) {
        this.builder.removeModuleById(id);
        this.innerDeps.delete(id);
      }
    }
  }

  private getSingleResolution(request: string, dep: Dep) {
    let c = this.resolutions.get(request);
    if (!c) {
      c = new SingleResolveComputation(
        this.registry,
        this.module,
        request,
        dep
      );
      c.subscribe(this);
      this.resolutions.set(request, c);
    }
    return c;
  }

  private addInnerModule(innerId: string, transforms: Transforms) {
    const id = this.builder.addInnerModule(innerId, this.module, transforms);
    this.innerDeps.add(id);
    return id;
  }

  protected async run(
    _: FinalModule | null,
    isRunning: () => void
  ): Promise<CValue<FinalModule>> {
    const [result, error] = await this.getDep(this.module.pipeline);
    isRunning();

    if (error) {
      return [null, error];
    }

    const resolvedId = this.id++;

    const { id: transformedId, asset: sharedAsset } = result!;
    const asset = deserialize<TransformableAsset>(sharedAsset);
    const { depsInfo } = asset;

    const deps: Map<string, ResolvedDep> = new Map();
    const innerDeps: Map<string, ResolvedInnerDep> = new Map();
    const requires: (ResolvedDep | ResolvedInnerDep)[] = [];

    const jobs: Promise<CValue<ResolvedDep>>[] = [];
    const requests: Set<string> = new Set();

    if (depsInfo && depsInfo.dependencies) {
      for (const [request, dep] of depsInfo.dependencies) {
        const c = this.getSingleResolution(request, dep);
        requests.add(request);
        jobs.push(c.get());
      }
    }

    this.cleanResolutions(requests);

    const innerDepsIds: Set<string> = new Set();

    if (depsInfo && depsInfo.innerDependencies) {
      for (const [innerId, innerDep] of depsInfo.innerDependencies) {
        const resolved = {
          id: "",
          innerId,
          type: innerDep.type,
          async: !!innerDep.async,
          transforms:
            innerDep.transforms ||
            this.builder.userConfig.getTransformationsForType(innerDep.type),
        };

        resolved.id = this.addInnerModule(innerId, resolved.transforms);
        innerDepsIds.add(resolved.id);

        innerDeps.set(resolved.innerId, resolved);
        requires.push(resolved);
      }
    }

    this.cleanInnerDeps(innerDepsIds);

    for (const p of jobs) {
      const [_resolved, error] = await p;

      if (error) {
        return [null, error];
      }

      const resolved = _resolved!;
      deps.set(resolved.request, resolved);
      requires.push(resolved);
    }

    isRunning();

    const finalModule = {
      id: this.module.id,
      path: this.module.path,
      relativePath: this.module.relativePath,
      innerId: this.module.innerId,
      transformedId,
      resolvedId,
      type: asset.type,
      asset: sharedAsset,
      dependencies: deps,
      innerDependencies: innerDeps,
      requires,
    };

    this.builder.notifyCheckers(finalModule);

    return [finalModule, null];
  }
}
