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
    const state = this.head.value;
    this.head = this.head.next;
    if (!this.head) this.tail = null;
    return state;
  }
}

// Assuming the states considered form a DAG

export abstract class BaseTopologicalOrder<State> {
  abstract inEdgesAmount(state: State): number;

  abstract destinations(state: State): IterableIterator<State>;

  *depthFirstAlgorithm(states: readonly State[]) {
    const marked = new Set<State>();
    const reversedOrder: State[] = [];

    for (const state of states) {
      visit(this, state);
    }

    function visit(self: BaseTopologicalOrder<State>, state: State) {
      if (marked.has(state)) {
        return;
      }

      for (const dest of self.destinations(state)) {
        visit(self, dest);
      }

      marked.add(state);
      reversedOrder.push(state);
    }

    let i = reversedOrder.length;
    while (i--) {
      yield reversedOrder[i];
    }
  }

  *kahnsAlgorithm(states: readonly State[]) {
    const queue = new Queue<State>();
    const inEdgesMap = new Map<State, number>();

    for (const s of states) {
      const inEdges = this.inEdgesAmount(s);
      inEdgesMap.set(s, inEdges);
      if (inEdges === 0) {
        queue.enqueue(s);
      }
    }

    while (true) {
      const state = queue.dequeue();
      if (!state) break;
      yield state;

      for (const dest of this.destinations(state)) {
        const inEdges = inEdgesMap.get(dest)!! - 1;
        inEdgesMap.set(dest, inEdges);
        if (inEdges === 0) {
          queue.enqueue(dest);
        }
      }
    }
  }
}
