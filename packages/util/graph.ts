import { setAdd } from "./maps-sets";

export class Edge<N, E> {
  constructor(
    readonly a: Node<N, E>,
    readonly data: E,
    readonly b: Node<N, E>
  ) {}
}

export class Node<N, E> {
  readonly inEdges: Edge<N, E>[] = [];
  readonly outEdges: Edge<N, E>[] = [];

  constructor(readonly data: N) {}
}

export class Graph<N, E> {
  private readonly nodes = new Map<N, Node<N, E>>();

  node(data: N) {
    let node = this.nodes.get(data);
    if (node == null) {
      node = new Node(data);
      this.nodes.set(data, node);
    }
    return node;
  }

  edge(a: N, data: E, b: N) {
    const nodeA = this.node(a);
    const nodeB = this.node(b);
    const edge = new Edge(nodeA, data, nodeB);
    nodeA.outEdges.push(edge);
    nodeB.inEdges.push(edge);
  }

  *inDest(data: N) {
    const node = this.node(data);
    for (const edge of node.inEdges) {
      yield edge.a.data;
    }
  }

  *outDest(data: N) {
    const node = this.node(data);
    for (const edge of node.outEdges) {
      yield edge.b.data;
    }
  }
}

export function* walkUp<N>(node: Node<N, null>): Iterable<Node<N, null>> {
  for (const edge of node.inEdges) yield edge.a;
}

export function* walkDown<N>(node: Node<N, null>): Iterable<Node<N, null>> {
  for (const edge of node.outEdges) yield edge.b;
}

export function* traverse<N>(
  start: N,
  children: (node: N) => Iterable<N>
): Generator<N, void, boolean> {
  const queue: N[] = [];
  if (yield start) queue.push(start);

  while (queue.length) {
    const node = queue.pop()!;
    for (const child of children(node)) {
      if (yield child) queue.push(child);
    }
  }
}

export function traverseAll<N>(start: N, children: (node: N) => Iterable<N>) {
  const seen = new Set<N>();
  const it = traverse(start, children);
  for (let step = it.next(); !step.done; ) {
    step = it.next(setAdd(seen, step.value));
  }
}
