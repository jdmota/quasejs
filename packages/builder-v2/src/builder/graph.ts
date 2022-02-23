import { Manifest, FinalModule, FinalAsset, ProcessedGraph } from "../types";
import { hashName } from "../utils/hash";
import { reExt } from "../utils/path";
import { UserConfig } from "./user-config";
import { ModuleRegistry } from "../module/module-registry";

const modulesSorter = ({ id: a }: { id: string }, { id: b }: { id: string }) =>
  a.localeCompare(b);

export class Graph {
  appEntriesId: readonly string[];
  modules: Map<string, FinalModule>;
  entrypoints: Set<string>;
  incs: Map<FinalModule, FinalModule[]>;
  inline: Map<FinalModule, FinalModule>;
  hashIds: Map<string, string>;
  groups: Map<FinalModule, number>;
  private n: number;
  private registry: ModuleRegistry;

  constructor(
    userConfig: UserConfig,
    registry: ModuleRegistry,
    appEntriesId: readonly string[]
  ) {
    this.appEntriesId = appEntriesId;
    this.modules = new Map();
    this.entrypoints = new Set();
    this.incs = new Map();
    this.inline = new Map();
    this.hashIds = new Map();
    this.groups = new Map();
    this.n = 0;
    this.registry = registry;
    this.init(userConfig);
  }

  [Symbol.iterator]() {
    return this.modules.entries();
  }

  // Adapted from https://github.com/samthor/srcgraph
  private addEntrypoint(entry: string) {
    this.entrypoints.add(entry);

    // every bit at 1 says that the module belongs to a certain group
    // for example
    // 1010 is for the module that is reached from entrypoint index 1 and 3
    // 1010 == ( 1 << 1 ) || ( 1 << 3 )
    const pending = new Set([this.getAndMark(entry)]);
    for (const next of pending) {
      this.groups.set(next, (this.groups.get(next) || 0) | (1 << this.n));
      for (const { id } of next.requires) {
        pending.add(this.getAndMark(id));
      }
    }
    this.n++;
  }

  private getAndMark(id: string) {
    let module;
    module = this.modules.get(id);
    if (module) {
      // Already marked and stored in graph
    } else {
      module = this.registry.getAndMark(id);
      this.modules.set(module.id, module);
      this.incs.set(module, []);
    }
    return module;
  }

  private init(userConfig: UserConfig) {
    // Store FinalModule's, fill "groups",
    // take advantage of the graph traversal to mark reachable modules
    for (const entry of this.appEntriesId) {
      this.addEntrypoint(entry);
    }

    if (userConfig.optimization.hashId) {
      // Give hash names to each module
      // To have deterministic results in the presence of conflicts
      // Sort all the modules by their original id

      const usedIds: Set<string> = new Set();
      const modulesList = Array.from(this.modules.values()).sort(modulesSorter);

      for (const module of modulesList) {
        this.hashIds.set(module.id, hashName(module.id, usedIds, 5));
      }
    } else {
      for (const module of this.modules.values()) {
        this.hashIds.set(module.id, module.id);
      }
    }

    const splitPoints: Set<FinalModule> = new Set();

    for (const module of this.modules.values()) {
      for (const dep of module.requires) {
        const required = get(this.modules, dep.id);
        const splitPoint =
          dep.async || userConfig.isSplitPoint(required, module);

        if (splitPoint) {
          splitPoints.add(required);
        } else if (required.innerId || required.type !== module.type) {
          this.inline.set(required, module);
        }
        const l = get(this.incs, required);
        if (!l.includes(module)) {
          l.push(module);
        }
      }
    }

    // If a module was splitted from some other module,
    // make sure it's not inlined and make it an entrypoint.
    for (const split of splitPoints) {
      this.addEntrypoint(split.id);
      this.inline.delete(split);
    }

    // If a module is required in more than one module,
    // don't inline it. Otherwise, make it an entrypoint.
    for (const inline of this.inline.keys()) {
      const r = this.requiredBy(inline);
      if (r.length === 1) {
        this.addEntrypoint(inline.id);
      } else {
        this.inline.delete(inline);
      }
    }

    // Sort...
    this.incs.forEach(value => value.sort(modulesSorter));
  }

  // Get all the sync dependencies of a module
  syncDeps(module: FinalModule, set: Set<FinalModule> = new Set()) {
    for (const { id, async } of module.requires) {
      const required = get(this.modules, id);

      if (!async && !set.has(required)) {
        set.add(required);
        this.syncDeps(required, set);
      }
    }
    return set;
  }

  requiredAssets(
    module: FinalModule,
    moduleToFile: ReadonlyMap<FinalModule, FinalAsset>
  ) {
    const set: Set<FinalAsset> = new Set();

    const asset = moduleToFile.get(module);
    if (asset) {
      set.add(asset);
    }

    for (const dep of this.syncDeps(module)) {
      const asset = moduleToFile.get(dep);
      if (asset) {
        set.add(asset);
      }
    }
    return Array.from(set);
  }

  requiredBy(module: FinalModule) {
    return this.incs.get(module) || [];
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
      for (const { id } of module.requires) {
        g.addEdge(module.id, id);
      }
    }

    await fs.outputFile(file, g.to_dot());
  }
}

// Adapted from https://github.com/samthor/srcgraph
export function processGraph(graph: Graph): ProcessedGraph {
  // Find all modules that will be in the file
  // with entrypoint "from"
  const grow = (from: FinalModule): Map<string, FinalModule> | null => {
    const group = graph.groups.get(from);
    const wouldSplitSrc = (src: FinalModule) => {
      // Entrypoints are always their own starting point
      if (graph.entrypoints.has(src.id)) {
        return true;
      }
      // Split if "src" belongs to a different group
      if (graph.groups.get(src) !== group) {
        return true;
      }
      // Split if "src" has an input from other group
      const all = graph.requiredBy(src);
      return all.some(other => graph.groups.get(other) !== group);
    };

    // Not a module entrypoint
    if (!wouldSplitSrc(from)) {
      return null;
    }

    const result = new Map([[from.id, from]]);
    const include = [from];
    const seen = new Set(include);

    for (let i = 0, curr; (curr = include[i]); ++i) {
      for (const { id } of curr.requires) {
        const required = get(graph.modules, id);

        if (seen.has(required)) {
          continue;
        }
        seen.add(required);
        if (!wouldSplitSrc(required)) {
          include.push(required);
          result.set(required.id, required);
        }
      }
    }

    return result;
  };

  const files: FinalAsset[] = [];
  const inlineAssets: FinalAsset[] = [];
  const filesByPath: Map<string, FinalAsset[]> = new Map();
  const moduleToFile: Map<FinalModule, FinalAsset> = new Map();

  for (const m of graph.groups.keys()) {
    const srcs = grow(m);
    if (srcs) {
      const hashId = get(graph.hashIds, m.id);
      const f: FinalAsset = {
        module: m,
        relativeDest: m.relativePath.replace(reExt, `.${hashId}.${m.type}`),
        hash: null,
        isEntry: graph.appEntriesId.includes(m.id),
        srcs,
        inlineAssets: [],
        runtime: {
          code: null,
          manifest: null,
        },
        manifest: {
          files: [],
          moduleToAssets: new Map(),
        },
      };

      // If "m" is a module that will be inline
      if (graph.inline.has(m)) {
        inlineAssets.push(f);
      } else {
        files.push(f);
      }

      // For each module, what file it belongs to
      for (const src of srcs.values()) {
        moduleToFile.set(src, f);
      }
    }
  }

  // Save inline assets in each respective asset that required it
  for (const inlineAsset of inlineAssets) {
    const requiredBy = get(graph.inline, inlineAsset.module);
    get(moduleToFile, requiredBy).inlineAssets.push(inlineAsset);
  }

  // Attempt to have simpler unique file names
  for (const f of files) {
    const possibleDest = f.module.relativePath.replace(
      reExt,
      `.${f.module.type}`
    );
    const arr = filesByPath.get(possibleDest) || [];
    arr.push(f);
    filesByPath.set(possibleDest, arr);
  }

  // Only assign the new file name, if it conflicts with no other file
  for (const [possibleDest, files] of filesByPath) {
    if (files.length === 1) {
      files[0].relativeDest = possibleDest;
    }
  }

  // Now remove modules from inline assets for the next step
  for (const [module, file] of moduleToFile) {
    if (graph.inline.has(file.module)) {
      moduleToFile.delete(module);
    }
  }

  // Extract the modules that are dependencies of modules in this asset
  // Excluding modules already in this asset
  function assetDependencies(asset: FinalAsset): Set<FinalModule> {
    const set: Set<FinalModule> = new Set();
    for (const src of asset.srcs.values()) {
      for (const { id } of src.requires) {
        const required = get(graph.modules, id);

        if (!asset.srcs.has(required.id)) {
          set.add(required);
        }
      }
    }
    return set;
  }

  // "module" -> "assets" mapping necessary for the runtime
  // It tells for each module, which files it needs to fetch
  const globalModuleToAssets: { [id: string]: string[] } = {};

  for (const module of moduleToFile.keys()) {
    const hashId = get(graph.hashIds, module.id);
    // Sort to get deterministic results
    globalModuleToAssets[hashId] = graph
      .requiredAssets(module, moduleToFile)
      .map(f => f.relativeDest)
      .sort();
  }

  // Manifest for each asset
  // Optimized by not specifying the asset itself and modules already present in it
  function manifest(asset: FinalAsset): Manifest {
    const moduleToAssets: Map<string, string[]> = new Map();
    const files: Set<string> = new Set();

    for (const module of assetDependencies(asset)) {
      const hashId = get(graph.hashIds, module.id);
      const assets = globalModuleToAssets[hashId];

      // Store required assets except this one
      for (const f of assets) {
        if (f !== asset.relativeDest) {
          files.add(f);
        }
      }
      moduleToAssets.set(
        hashId,
        assets.filter(a => a !== asset.relativeDest)
      );
    }
    return {
      files: Array.from(files).sort(),
      moduleToAssets,
    };
  }

  for (const f of files) {
    f.manifest = manifest(f);
  }

  return {
    hashIds: graph.hashIds,
    moduleToFile,
    files: sortFilesByEntry(files), // Leave entries last
    moduleToAssets: globalModuleToAssets,
  };
}

function sortFilesByEntry(files: FinalAsset[]) {
  return files.sort((a, b) => +a.isEntry - +b.isEntry);
}

function get<K, V>(map: ReadonlyMap<K, V>, key: K): V {
  const value = map.get(key);
  if (value) {
    return value;
  }
  throw new Error("Assertion error");
}
