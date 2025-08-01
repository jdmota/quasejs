type Node<V> = { value: V; next: Node<V> | null };

class Queue<V> {
  private head: Node<V> | null = null;
  private tail: Node<V> | null = null;

  enqueue(value: V) {
    const node = { value, next: null };
    if (this.tail) {
      this.tail.next = node;
    } else {
      this.head = node;
    }
    this.tail = node;
  }

  dequeue() {
    if (!this.head) return null;
    const value = this.head.value;
    this.head = this.head.next;
    if (!this.head) this.tail = null;
    return value;
  }
}

// Assuming the nodes considered form a DAG

export abstract class BaseTopologicalOrder<Node> {
  abstract inEdgesAmount(node: Node): number;

  abstract destinations(node: Node): Iterable<Node>;

  *process(nodes: readonly Node[]) {
    const queue = new Queue<Node>();
    const inEdgesMap = new Map<Node, number>();

    for (const s of nodes) {
      const inEdges = this.inEdgesAmount(s);
      inEdgesMap.set(s, inEdges);
      if (inEdges === 0) {
        queue.enqueue(s);
      }
    }

    while (true) {
      const node = queue.dequeue();
      if (!node) break;
      yield node;

      for (const dest of this.destinations(node)) {
        const inEdges = inEdgesMap.get(dest)!! - 1;
        inEdgesMap.set(dest, inEdges);
        if (inEdges === 0) {
          queue.enqueue(dest);
        }
      }
    }
  }
}
