type LinkedListNode<V> = {
  value: V;
  next: LinkedListNode<V> | null;
};

export class LinkedList<V> {
  private head: LinkedListNode<V> | null;
  private tail: LinkedListNode<V> | null;

  constructor() {
    this.head = null;
    this.tail = null;
  }

  addLast(value: V) {
    const node: LinkedListNode<V> = {
      value,
      next: null,
    };
    if (this.tail == null) {
      this.head = node;
    } else {
      this.tail.next = node;
    }
    this.tail = node;
  }

  removeFirst(): V | undefined {
    if (this.head == null) {
      return undefined;
    }
    const value = this.head.value;
    if (this.head == this.tail) {
      this.head = null;
      this.tail = null;
    } else {
      this.head = this.head.next;
    }
    return value;
  }

  *iterateAndRemove() {
    while (this.head) {
      const value = this.head.value;
      this.head = this.head.next;
      if (this.head == null) this.tail = null;
      yield value;
    }
  }

  find(fn: (val: V) => boolean): V | undefined {
    let node = this.head;
    while (node) {
      if (fn(node.value)) {
        return node.value;
      }
      node = node.next;
    }
    return undefined;
  }

  remove(fn: (val: V) => boolean): V | undefined {
    let prev: LinkedListNode<V> | null = null;
    let node = this.head;
    while (node) {
      if (fn(node.value)) {
        if (prev) {
          prev.next = node.next;
        } else {
          this.head = node.next;
        }
        if (node.next == null) {
          this.tail = prev;
        }
        return node.value;
      }
      prev = node;
      node = node.next;
    }
    return undefined;
  }

  *[Symbol.iterator]() {
    let node = this.head;
    while (node) {
      yield node.value;
      node = node.next;
    }
  }
}

export class SpecialQueue<N extends { prev: N | null; next: N | null }> {
  private head: N | null;

  constructor() {
    this.head = null;
  }

  peek() {
    return this.head;
  }

  isEmpty() {
    return this.head == null;
  }

  private checkNew(node: N) {
    if (node.prev != null || node.next != null) {
      throw new Error("Node belongs to some linked-list");
    }
  }

  private checkConnected(node: N) {
    if (node.prev == null && node.next == null) {
      throw new Error("Node does not belong to any linked-list");
    }
  }

  add(node: N) {
    this.checkNew(node);

    if (this.head) {
      this.head.prev = node;
      node.next = this.head;
    }
    this.head = node;
  }

  delete(node: N) {
    this.checkConnected(node);

    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }
    if (node.next) {
      node.next.prev = node.prev;
    }

    node.prev = null;
    node.next = null;
  }

  // Iteration stable over modifications
  *keepTaking(): IterableIterator<N> {
    while (this.head) {
      yield this.head;
    }
  }

  // Iteration not stable over modifications
  *iterateAll(): IterableIterator<N> {
    let node = this.head;
    while (node) {
      yield node;
      node = node.next;
    }
  }
}
