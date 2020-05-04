import pathModule from "path";
import { Graph, GraphNode } from "../utils/graph";
import { ComputationRegistry } from "../utils/computation-registry";
import { FileDependency } from "./graph-nodes/file";
import { TransformComputation } from "./graph-nodes/transform";
import { DefaultMap } from "../utils/default-map";
import { Builder } from "./builder";
import {
  AssetRequest,
  WatchedFileInfo,
  serializerAssetRequest,
} from "../types";

type FileObj = {
  addOrRemove: FileDependency | null;
  change: FileDependency | null;
};

export class BuilderGraph extends Graph {
  readonly builder: Builder;
  readonly computations: ComputationRegistry<BuilderGraph>;
  private readonly files: DefaultMap<string, void, FileObj>;
  private readonly assets: DefaultMap<
    string,
    AssetRequest,
    TransformComputation
  >;
  private entries: Set<TransformComputation>;

  constructor(builder: Builder) {
    super();
    this.builder = builder;
    this.computations = new ComputationRegistry(this);
    this.files = new DefaultMap(() => ({
      addOrRemove: null,
      change: null,
    }));
    this.assets = new DefaultMap(assetRequest =>
      this.addNode(new TransformComputation(this, assetRequest))
    );
    this.entries = new Set();
  }

  addFile(path: string, event: keyof FileObj) {
    const obj = this.files.get(path);
    let fileDep = obj[event];

    if (!fileDep) {
      fileDep = this.addNode(new FileDependency(this, path, event));
      obj[event] = fileDep;
    }

    return fileDep;
  }

  subscribeFiles(
    files: ReadonlyMap<string, WatchedFileInfo>,
    getDep: (dep: FileDependency) => void
  ) {
    for (const [file, info] of files) {
      this.subscribeFile(file, info, getDep);
    }
  }

  subscribeFile(
    path: string,
    info: WatchedFileInfo,
    getDep: (dep: FileDependency) => void
  ) {
    getDep(this.addFile(path, info.onlyExistance ? "addOrRemove" : "change"));
    // TODO use info.time
  }

  fileAdded(path: string) {
    const obj = this.files.maybeGet(path);
    if (obj) {
      if (obj.change) {
        obj.change.invalidate();
      }
      if (obj.addOrRemove) {
        obj.addOrRemove.invalidate();
      }
      // Also invalidate folder
      this.fileChanged(pathModule.dirname(path));
    }
  }

  fileChanged(path: string) {
    const obj = this.files.maybeGet(path);
    if (obj) {
      if (obj.change) {
        obj.change.invalidate();
      }
    }
  }

  fileRemoved(path: string) {
    this.fileAdded(path); // Same implementation
  }

  watchedFiles() {
    return new Set(this.files.keys());
  }

  private submitEntries(requests: AssetRequest[]) {
    const oldEntries = this.entries;
    this.entries = new Set();
    for (const request of requests) {
      const entry = this.addAssetRequest(request);
      this.entries.add(entry);
      if (!oldEntries.delete(entry)) entry.incRef();
    }
    for (const oldEntry of oldEntries) {
      oldEntry.decRef();
    }
  }

  addAssetRequest(assetRequest: AssetRequest) {
    return this.assets.get(serializerAssetRequest(assetRequest), assetRequest);
  }

  removeNode(node: GraphNode<BuilderGraph>) {
    super.removeNode(node);

    if (node instanceof FileDependency) {
      const obj = this.files.maybeGet(node.path);
      if (obj) {
        obj[node.event] = null;
      }
    } else if (node instanceof TransformComputation) {
      this.assets.delete(serializerAssetRequest(node.request));
    }
  }

  interrupt() {
    this.computations.interrupt();
  }

  wasInterrupted() {
    return this.computations.wasInterrupted();
  }

  run(entries: AssetRequest[]) {
    this.submitEntries(entries);
    return this.computations.run();
  }
}
