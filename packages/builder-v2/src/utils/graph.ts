import { DefaultMap } from "./default-map";

const defaultSet = <T>() => new Set<T>();

export abstract class GraphNode<G extends Graph> {
  protected readonly graph: G;

  constructor(graph: G) {
    this.graph = graph;
  }

  abstract isNodeOrphan(): boolean;
  abstract destroy(): void;
  protected abstract onInEdgeAddition(): void;
  protected abstract onInEdgeRemoval(): void;
}

export class BasicGraphNode<G extends Graph> extends GraphNode<G> {
  private outEdges: DefaultMap<string, void, Set<BasicGraphNode<G>>>;
  private inEdges: DefaultMap<string, void, Set<BasicGraphNode<G>>>;

  constructor(graph: G) {
    super(graph);
    this.outEdges = new DefaultMap<string, void, Set<BasicGraphNode<G>>>(
      defaultSet
    );
    this.inEdges = new DefaultMap<string, void, Set<BasicGraphNode<G>>>(
      defaultSet
    );
  }

  protected onInEdgeAddition() {}

  protected onInEdgeRemoval() {
    if (this.isNodeOrphan()) {
      this.graph.removeNode(this);
    }
  }

  static addEdge<G extends Graph>(
    from: BasicGraphNode<G>,
    edge: string,
    to: BasicGraphNode<G>
  ) {
    from.addOutEdge(edge, to);
    to.addInEdge(from, edge);
  }

  static removeEdge<G extends Graph>(
    from: BasicGraphNode<G>,
    edge: string,
    to: BasicGraphNode<G>
  ) {
    from.removeOutEdge(edge, to);
    to.removeInEdge(from, edge);
  }

  private addOutEdge(edge: string, to: BasicGraphNode<G>) {
    this.outEdges.get(edge).add(to);
  }

  private addInEdge(from: BasicGraphNode<G>, edge: string) {
    this.inEdges.get(edge).add(from);
    this.onInEdgeAddition();
  }

  private removeOutEdge(edge: string, to: BasicGraphNode<G>) {
    this.outEdges.get(edge).delete(to);
  }

  private removeInEdge(from: BasicGraphNode<G>, edge: string) {
    this.inEdges.get(edge).delete(from);
    this.onInEdgeRemoval();
  }

  getOutEdges() {
    return this.outEdges.entries();
  }

  getInEdges() {
    return this.inEdges.entries();
  }

  isNodeOrphan(): boolean {
    for (const [, edges] of this.getInEdges()) {
      if (edges.size > 0) {
        return false;
      }
    }
    return true;
  }

  destroy() {
    for (const [edge, nodes] of this.getOutEdges()) {
      for (const to of nodes) {
        to.removeInEdge(this, edge);
      }
    }

    for (const [edge, nodes] of this.getInEdges()) {
      for (const from of nodes) {
        from.removeOutEdge(edge, this);
      }
    }
  }
}

export class Graph {
  protected nodes: Set<GraphNode<Graph>>;

  constructor() {
    this.nodes = new Set();
  }

  addNode<T extends GraphNode<Graph>>(node: T) {
    this.nodes.add(node);
    return node;
  }

  removeNode(node: GraphNode<Graph>) {
    this.nodes.delete(node);
    node.destroy();
  }
}
