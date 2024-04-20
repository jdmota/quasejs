type Range = { from: number; to: number };

type Node<T> = {
  range: Range;
  value: T;
  prev: Node<T> | null;
  next: Node<T> | null;
};

export class MapRangeToValue<T> {
  private head: Node<T> | null;
  size: number;

  constructor() {
    this.head = null;
    this.size = 0;
  }

  addRange(from: number, to: number, value: T) {
    let curr = this.head;
    let node = this._node(from, to, value);

    if (curr == null) {
      this.head = node;
      this.size = 1;
      return true;
    }

    while (true) {
      if (node.range.to < curr.range.from) {
        this._insertBefore(node, curr);
        this.size++;
        return true;
      }

      if (curr.range.to < node.range.from) {
        if (curr.next) {
          curr = curr.next;
          continue;
        } else {
          this._insertAfter(node, curr);
          this.size++;
          return true;
        }
      }

      if (
        curr.value === node.value &&
        curr.range.from === node.range.from &&
        curr.range.to === node.range.to
      ) {
        return false;
      }

      throw new Error(
        `Already exists (curr:${curr.range.from},${curr.range.to},${curr.value}; node:${node.range.from},${node.range.to},${node.value})`
      );
    }
  }

  private _insertBefore(node: Node<T>, before: Node<T>) {
    node.prev = before.prev;
    before.prev = node;
    node.next = before;
    if (node.prev) {
      node.prev.next = node;
    } else {
      this.head = node;
    }
  }

  private _insertAfter(node: Node<T>, after: Node<T>) {
    node.next = after.next;
    after.next = node;
    node.prev = after;
    if (node.next) {
      node.next.prev = node;
    }
  }

  private _node(from: number, to: number, value: T): Node<T> {
    return {
      range: { from, to },
      value,
      prev: null,
      next: null,
    };
  }

  *[Symbol.iterator]() {
    let current = this.head;
    while (current) {
      yield [current.range, current.value] as const;
      current = current.next;
    }
  }
}
