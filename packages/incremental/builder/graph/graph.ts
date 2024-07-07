import { setAdd, get, getSet, copy } from "../../../util/maps-sets";
import { OneToMany } from "../../../util/data-structures/relationship";
import { hashName } from "./hash";

const numberSorter = (a: number, b: number) => a - b;

const stringSorter = (a: string, b: string) => a.localeCompare(b);

const modulesSorter = (
  { id: a }: { readonly id: string },
  { id: b }: { readonly id: string }
) => stringSorter(a, b);

type ModuleId = string;

type AssetId = string;

type RuntimeManifest = {
  f: string[];
  m: { [key: string]: number[] };
};

type Dep = {
  readonly importedId: string;
  readonly split: boolean;
  readonly async: boolean;
};

type Module = {
  readonly id: string;
  readonly deps: Dep[];
};

enum AssetType {
  JS = 0,
  WASM = 1,
  CSS = 2,
  HTML = 3,
}

enum EnvType {
  NODE = 0,
  BROWSER = 1,
  WORKER = 2,
}

export type { AssetType, EnvType, RuntimeManifest };

// Note: if a JS module async imports a CSS module,
// in practise, a JS file will be loaded which will dynamically load the CSS,
// and also deal with HMR. This way we do not need such logic in the runtime.
/*
elem = document.createElement("link");
elem.type = "text/css";
elem.rel = "stylesheet";
elem.href = href;
*/

type Asset = {
  id: AssetId;
  type: AssetType;
  modules: Set<Module>;
  runtime: {
    code: string;
    manifest: RuntimeManifest;
  } | null;
};

type AssetsAndModules = OneToMany<string, Module>;

type ModuleToNeededAssets = ReadonlyMap<Module, ReadonlySet<AssetId>>;

function setToString(set: ReadonlySet<Module>) {
  return JSON.stringify([...set].sort(modulesSorter));
}

export class Graph {
  private readonly modules: ReadonlyMap<ModuleId, Module>;

  constructor(modules: ReadonlyMap<ModuleId, Module>) {
    this.modules = modules;
  }

  // The set of entries from which each module is reachable
  private reachableFrom(entries: readonly Module[]) {
    const reachableFrom = new Map<Module, Set<Module>>();
    const pending = new Set<Module>();
    const addEntrypoint = (entry: Module) => {
      if (setAdd(getSet(reachableFrom, entry), entry)) {
        pending.add(entry);
      }
    };

    entries.forEach(addEntrypoint);

    for (const module of pending) {
      pending.delete(module);

      const group = getSet(reachableFrom, module);
      for (const { importedId, split } of module.deps) {
        const imported = get(this.modules, importedId);
        if (split) {
          addEntrypoint(imported);
        } else {
          if (copy(group, getSet(reachableFrom, imported))) {
            pending.add(imported);
          }
        }
      }
    }

    return reachableFrom;
  }

  assetsAndModules(entries: readonly Module[]): AssetsAndModules {
    const reachableFrom = this.reachableFrom(entries);
    const assetToModules = new OneToMany<AssetId, Module>();
    for (const [module, group] of reachableFrom) {
      const assetId = setToString(group);
      assetToModules.add(assetId, module);
    }
    return assetToModules;
  }

  neededSyncAssets(module: Module, assetToModules: OneToMany<AssetId, Module>) {
    const seen = new Set<Module>([module]);
    const neededAssets = new Set<AssetId>();

    for (const module of seen) {
      neededAssets.add(assetToModules.getOne(module)!);

      for (const { importedId, async } of module.deps) {
        const imported = get(this.modules, importedId);
        if (!async) {
          seen.add(imported);
        }
      }
    }

    return neededAssets;
  }

  // Extract the modules that are async dependencies of the modules in this set
  assetAsyncDeps(modules: ReadonlySet<Module>) {
    const set = new Set<Module>();
    for (const module of modules) {
      for (const { importedId, async } of module.deps) {
        const required = get(this.modules, importedId);

        if (async) {
          set.add(required);
        }
      }
    }
    return set;
  }

  // Manifest for an asset saying for each async import
  // which are the assets that need to be loaded
  // to ensure all the sync dependencies are available
  // Note: this is optimized for production, not to be used for HMR
  manifest(
    assetId: AssetId,
    assetToModules: OneToMany<AssetId, Module>,
    globalModuleToNeededAssets: ModuleToNeededAssets
  ) {
    const assets = new Set<AssetId>();
    const moduleToNeededAssets = new Map<Module, Set<AssetId>>();

    for (const module of this.assetAsyncDeps(assetToModules.getMany(assetId))) {
      const neededAssets = new Set(get(globalModuleToNeededAssets, module));
      neededAssets.delete(assetId); // Exclude this asset itself
      // TODO also exclude all the other assets that would have had to been loaded before
      // (like assets needed for the evaluation of this asset at sync time)

      copy(neededAssets, assets);
      moduleToNeededAssets.set(module, neededAssets);
    }

    return {
      assets,
      moduleToNeededAssets,
    };
  }

  manifestJson(
    assetId: AssetId,
    assetToModules: AssetsAndModules,
    globalModuleToNeededAssets: ModuleToNeededAssets
  ) {
    const json: RuntimeManifest = {
      f: [],
      m: {},
    };
    const { assets, moduleToNeededAssets } = this.manifest(
      assetId,
      assetToModules,
      globalModuleToNeededAssets
    );

    const sortedAssets = Array.from(assets).sort(stringSorter);
    const assetToIdx = new Map<AssetId, number>();

    for (let i = 0; i < sortedAssets.length; i++) {
      const assetId = sortedAssets[i];
      assetToIdx.set(assetId, i);
      json.f.push(assetId);
    }

    const sortedModules = Array.from(moduleToNeededAssets.keys()).sort(
      modulesSorter
    );

    for (const module of sortedModules) {
      json.m[module.id] = Array.from(get(moduleToNeededAssets, module))
        .map(assetId => get(assetToIdx, assetId))
        .sort(numberSorter);
    }
    return json;
  }

  async dumpDotGraph(file: string) {
    const graphviz = require("graphviz");
    const fs = require("fs-extra");
    const g = graphviz.digraph("G");

    const modulesList = Array.from(this.modules.values()).sort(modulesSorter);

    for (const module of modulesList) {
      const n = g.addNode(module.id);
      n.set("color", "gray");
      n.set("shape", "box");
      n.set("style", "filled");
    }

    for (const module of modulesList) {
      for (const { importedId } of module.deps) {
        g.addEdge(module.id, importedId);
      }
    }

    await fs.outputFile(file, g.to_dot());
  }
}

// TODO hashIds and filenames for assets
export function processGraph(
  modules: ReadonlyMap<string, Module>,
  entries: readonly Module[]
) {
  const graph = new Graph(modules);
  const assetToModules = graph.assetsAndModules(entries);

  // Avoid recomputing the needed assets for each module when creating the manifest
  // And use this in HMR
  const globalModuleToNeededAssets = new Map<Module, Set<AssetId>>();
  for (const module of modules.values()) {
    const neededAssets = graph.neededSyncAssets(module, assetToModules);
    globalModuleToNeededAssets.set(module, neededAssets);
  }

  for (const assetId of assetToModules.keys()) {
    const runtimeManifest = graph.manifestJson(
      assetId,
      assetToModules,
      globalModuleToNeededAssets
    );
  }
}
