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

  add(value: V) {
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

  *iterateAndRemove() {
    while (this.head) {
      const value = this.head.value;
      this.head = this.head.next;
      if (this.head == null) this.tail = null;
      yield value;
    }
  }
}
