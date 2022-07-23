import { DefaultMap } from "./default-map";

const defaultSet = <T>() => new Set<T>();

function add<T>(set: Set<T>, value: T): boolean {
  const size = set.size;
  set.add(value);
  return set.size > size;
}

export function createGraphTemplate<N, E>() {
  class GraphNode {
    private readonly graph: Graph;
    private readonly value: N;
    private readonly outEdges: DefaultMap<E, Set<GraphNode>>;
    private readonly inEdges: DefaultMap<E, Set<GraphNode>>;
    private outEdgesAmount: number;
    private inEdgesAmount: number;

    constructor(graph: Graph, value: N) {
      this.graph = graph;
      this.outEdges = new DefaultMap<E, Set<GraphNode>>(defaultSet);
      this.inEdges = new DefaultMap<E, Set<GraphNode>>(defaultSet);
      this.outEdgesAmount = 0;
      this.inEdgesAmount = 0;
      this.value = value;
    }

    getValue(): N {
      return this.value;
    }

    protected onInEdgeAddition() {}

    protected onInEdgeRemoval() {
      if (this.isNodeOrphan()) {
        this.graph.removeNode(this);
      }
    }

    static addEdge(from: GraphNode, edge: E, to: GraphNode) {
      from.outEdges.get(edge).add(to);
      if (add(to.inEdges.get(edge), from)) {
        from.outEdgesAmount++;
        to.inEdgesAmount++;
        to.onInEdgeAddition();
      }
    }

    static removeEdge(from: GraphNode, edge: E, to: GraphNode) {
      from.outEdges.get(edge).delete(to);
      if (to.inEdges.get(edge).delete(from)) {
        from.outEdgesAmount--;
        to.inEdgesAmount--;
        to.onInEdgeRemoval();
      }
    }

    getOutCount() {
      return this.outEdgesAmount;
    }

    getInCount() {
      return this.inEdgesAmount;
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

  class Graph {
    protected nodes: Set<GraphNode>;

    constructor() {
      this.nodes = new Set();
    }

    createNode(value: N) {
      return new GraphNode(this, value);
    }

    addNode(node: GraphNode) {
      this.nodes.add(node);
      return node;
    }

    removeNode(node: GraphNode) {
      this.nodes.delete(node);
      node.destroy();
    }
  }

  return () => new Graph();
}
