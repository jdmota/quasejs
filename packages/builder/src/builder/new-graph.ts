import { Graph, GraphNode } from "../utils/graph";
import {
  AssetRequest,
  serializerAssetRequest,
  ImmutableAssets,
  ImmutableAsset,
  DependencyRequest,
  serializerDependencyRequest,
} from "../types";
import { DefaultMap } from "../utils/default-map";

// FIXME how to deal with circular dependencies? same for BuilderGraph probably

export class AssetsGraph extends Graph {
  private assetGroups: Map<string, AssetGroupNode>;

  constructor() {
    super();
    this.assetGroups = new Map();
  }

  addAssetGroup(request: AssetRequest, assets: ImmutableAssets) {
    const key = serializerAssetRequest(request);
    let node = this.assetGroups.get(key);
    if (!node) {
      node = this.addNode(new AssetGroupNode(this, request, key));
      this.assetGroups.set(key, node);
    }
    node.addAssets(assets);
    return node;
  }

  removeNode(node: GraphNode<AssetsGraph>) {
    super.removeNode(node);

    if (node instanceof AssetGroupNode) {
      this.assetGroups.delete(node.key);
    }
  }

  connect(from: AssetNode, edge: DependencyRequest, to: AssetGroupNode) {
    from.addDependency(edge, to);
    to.addDependent(from, edge);
  }

  disconnect(from: AssetNode, edge: DependencyRequest, to: AssetGroupNode) {
    from.removeDependency(edge, to);
    to.removeDependent(from, edge);
  }
}

export class AssetGroupNode extends GraphNode<AssetsGraph> {
  readonly request: AssetRequest;
  readonly key: string;
  readonly assets: DefaultMap<string, void, AssetNode>;
  readonly usedBy: Map<
    string,
    {
      dep: DependencyRequest;
      node: AssetNode;
    }
  >;
  isEntry: boolean;

  constructor(graph: AssetsGraph, request: AssetRequest, key: string) {
    super(graph);
    this.request = request;
    this.key = key;
    // In edges
    this.usedBy = new Map();
    this.isEntry = false;
    // Out edges
    this.assets = new DefaultMap(() => graph.addNode(new AssetNode(graph)));
  }

  protected onInEdgeAddition() {}

  protected onInEdgeRemoval() {
    if (this.isNodeOrphan()) {
      this.graph.removeNode(this);
    }
  }

  isNodeOrphan() {
    return !this.isEntry && this.usedBy.size === 0;
  }

  destroy() {
    for (const asset of this.assets.values()) {
      asset.unref();
    }
    this.assets.clear();
  }

  // In edges

  addDependent(from: AssetNode, dep: DependencyRequest) {
    const prevSize = this.usedBy.size;
    this.usedBy.set(serializerDependencyRequest(dep), {
      dep,
      node: from,
    });
    if (this.usedBy.size > prevSize) {
      this.onInEdgeAddition();
    }
  }

  removeDependent(from: AssetNode, dep: DependencyRequest) {
    if (this.usedBy.delete(serializerDependencyRequest(dep))) {
      this.onInEdgeRemoval();
    }
  }

  markEntry() {
    if (!this.isEntry) {
      this.isEntry = true;
      this.onInEdgeAddition();
    }
  }

  unmarkEntry() {
    if (this.isEntry) {
      this.isEntry = false;
      this.onInEdgeRemoval();
    }
  }

  // Out edges and update

  addAssets(assets: ImmutableAssets) {
    const oldAssets = new Map(this.assets.entries());

    for (const asset of assets) {
      this.assets
        .get(asset.id)
        .ref(this)
        .updateAsset(asset);
      oldAssets.delete(asset.id);
    }

    for (const [id, asset] of oldAssets) {
      this.assets.delete(id);
      asset.unref();
    }
  }
}

export class AssetNode extends GraphNode<AssetsGraph> {
  asset: ImmutableAsset | null;
  group: AssetGroupNode | null;
  readonly dependencies: Map<
    string,
    {
      dep: DependencyRequest;
      node: AssetGroupNode;
    }
  >;

  constructor(graph: AssetsGraph) {
    super(graph);
    this.asset = null;
    // In edges
    this.group = null;
    // Out edges
    this.dependencies = new Map();
  }

  protected onInEdgeAddition() {}

  protected onInEdgeRemoval() {
    if (this.isNodeOrphan()) {
      this.graph.removeNode(this);
    }
  }

  isNodeOrphan() {
    return this.group == null;
  }

  destroy() {
    this.group = null;
    this.disconnect();
  }

  private disconnect() {
    for (const { dep, node } of this.dependencies.values()) {
      this.graph.disconnect(this, dep, node);
    }
  }

  // In edges

  ref(group: AssetGroupNode) {
    if (this.group !== group) {
      this.group = group;
      this.onInEdgeAddition();
    }
    return this;
  }

  unref() {
    if (this.group != null) {
      this.group = null;
      this.onInEdgeRemoval();
    }
    return this;
  }

  // Out edges

  addDependency(dep: DependencyRequest, assetGroup: AssetGroupNode) {
    this.dependencies.set(serializerDependencyRequest(dep), {
      dep,
      node: assetGroup,
    });
  }

  removeDependency(dep: DependencyRequest, assetGroup: AssetGroupNode) {
    this.dependencies.delete(serializerDependencyRequest(dep));
  }

  // Update
  updateAsset(asset: ImmutableAsset) {
    this.asset = asset;
    this.disconnect();
  }
}
