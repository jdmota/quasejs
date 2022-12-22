import { setAdd, get, getSet, copy } from "../../utils/maps-sets";
import { OneToMany } from "../../utils/relationship";
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

type Asset = {
  id: AssetId;
  modules: Set<Module>;
  runtime: {
    code: string;
    manifest: RuntimeManifest;
  } | null;
};

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

  assetsAndModules(entries: readonly Module[]) {
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

  // Extract the modules that are async dependencies of the modules in this asset
  assetAsyncDeps(assetId: AssetId, assetToModules: OneToMany<AssetId, Module>) {
    const set = new Set<Module>();
    const modules = assetToModules.getMany(assetId);
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
  manifest(assetId: AssetId, assetToModules: OneToMany<AssetId, Module>) {
    const assets = new Set<AssetId>();
    const moduleToAssets = new Map<Module, Set<AssetId>>();

    for (const module of this.assetAsyncDeps(assetId, assetToModules)) {
      const neededAssets = this.neededSyncAssets(module, assetToModules);
      neededAssets.delete(assetId); // Exclude this asset itself

      copy(neededAssets, assets);
      moduleToAssets.set(module, neededAssets);
    }

    return {
      assets,
      moduleToAssets,
    };
  }

  manifestJson(assetId: AssetId, assetToModules: OneToMany<AssetId, Module>) {
    const json: RuntimeManifest = {
      f: [],
      m: {},
    };
    const { assets, moduleToAssets } = this.manifest(assetId, assetToModules);

    const sortedAssets = Array.from(assets).sort(stringSorter);
    const assetToIdx = new Map<AssetId, number>();

    for (const asset of sortedAssets) {
      assetToIdx.set(asset, json.f.push(asset) - 1);
    }

    const sortedModules = Array.from(moduleToAssets.keys()).sort(modulesSorter);

    for (const module of sortedModules) {
      json.m[module.id] = Array.from(get(moduleToAssets, module))
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

// TODO hashIds
export function processGraph(
  modules: ReadonlyMap<string, Module>,
  entries: readonly Module[]
) {
  const graph = new Graph(modules);
  const assetToModules = graph.assetsAndModules(entries);

  for (const assetId of assetToModules.keys()) {
    graph.manifestJson(assetId, assetToModules);
  }
}
