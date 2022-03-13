import { DefaultMap } from "./default-map";

const defaultSet = <T>() => new Set<T>();

function add<T>(set: Set<T>, value: T): boolean {
  const size = set.size;
  set.add(value);
  return set.size > size;
}

export class GraphNode<G extends Graph<E>, E> {
  private readonly graph: G;
  private outEdges: DefaultMap<E, Set<GraphNode<G, E>>>;
  private inEdges: DefaultMap<E, Set<GraphNode<G, E>>>;
  private inEdgesAmount: number;

  constructor(graph: G) {
    this.graph = graph;
    this.outEdges = new DefaultMap<E, Set<GraphNode<G, E>>>(defaultSet);
    this.inEdges = new DefaultMap<E, Set<GraphNode<G, E>>>(defaultSet);
    this.inEdgesAmount = 0;
  }

  protected onInEdgeAddition() {}

  protected onInEdgeRemoval() {
    if (this.isNodeOrphan()) {
      this.graph.removeNode(this);
    }
  }

  static addEdge<G extends Graph<E>, E>(
    from: GraphNode<G, E>,
    edge: E,
    to: GraphNode<G, E>
  ) {
    from.outEdges.get(edge).add(to);
    if (add(to.inEdges.get(edge), from)) {
      to.inEdgesAmount++;
      to.onInEdgeAddition();
    }
  }

  static removeEdge<G extends Graph<E>, E>(
    from: GraphNode<G, E>,
    edge: E,
    to: GraphNode<G, E>
  ) {
    from.outEdges.get(edge).delete(to);
    if (to.inEdges.get(edge).delete(from)) {
      to.inEdgesAmount--;
      to.onInEdgeRemoval();
    }
  }

  getOutEdges() {
    return this.outEdges.entries();
  }

  getInEdges() {
    return this.inEdges.entries();
  }

  isNodeOrphan(): boolean {
    return this.inEdgesAmount === 0;
    /*for (const [, edges] of this.getInEdges()) {
      if (edges.size > 0) {
        return false;
      }
    }
    return true;*/
  }

  destroy() {
    for (const [edge, nodes] of this.getOutEdges()) {
      for (const to of nodes) {
        GraphNode.removeEdge(this, edge, to);
      }
    }

    for (const [edge, nodes] of this.getInEdges()) {
      for (const from of nodes) {
        GraphNode.removeEdge(from, edge, this);
      }
    }
  }
}

export class Graph<E> {
  protected nodes: Set<GraphNode<Graph<E>, E>>;

  constructor() {
    this.nodes = new Set();
  }

  addNode<T extends GraphNode<Graph<E>, E>>(node: T) {
    this.nodes.add(node);
    return node;
  }

  removeNode(node: GraphNode<Graph<E>, E>) {
    this.nodes.delete(node);
    node.destroy();
  }
}
