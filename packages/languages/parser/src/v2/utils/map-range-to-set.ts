type Range = { from: number; to: number };

type Node<T> = {
  range: Range;
  value: ReadonlySet<T>;
  prev: Node<T> | null;
  next: Node<T> | null;
};

type NotRangeSet = (readonly [number, number])[];

function rangeComparator(
  a: readonly [number, number],
  b: readonly [number, number]
) {
  return a[0] - b[0];
}

export class MapRangeToSet<T> {
  private head: Node<T> | null;
  size: number;

  constructor() {
    this.head = null;
    this.size = 0;
  }

  addNotRangeSet(set: NotRangeSet, value: Set<T>, MIN: number, MAX: number) {
    set = set.sort(rangeComparator);

    let min = MIN;

    for (let i = 0; i < set.length; i++) {
      const el = set[i];
      if (min < el[0]) {
        this.addRange(min, el[0] - 1, value);
      }
      min = Math.max(min, el[1] + 1);
    }

    if (min < MAX) {
      this.addRange(min, MAX, value);
    }
  }

  addRange(from: number, to: number, value: ReadonlySet<T>) {
    let curr = this.head;
    let node = this.node(from, to, value);

    if (curr == null) {
      this.head = node;
      this.size = 1;
      return;
    }

    while (true) {
      if (node.range.to < curr.range.from) {
        this.insertBefore(node, curr);
        this.size++;
        return;
      }

      if (curr.range.to < node.range.from) {
        if (curr.next) {
          curr = curr.next;
          continue;
        } else {
          this.insertAfter(node, curr);
          this.size++;
          return;
        }
      }

      const { left, middle, right } = this.intersection(curr, node);

      if (left) {
        this.connect(curr.prev, left);
        this.connect(left, middle);
        this.size++;
      } else {
        this.connect(curr.prev, middle);
      }

      if (right) {
        if (curr.next) {
          if (right.range.to < curr.next.range.from) {
            this.connect(middle, right);
            this.connect(right, curr.next);
          } else {
            this.connect(middle, curr.next);
            curr = curr.next;
            node = right;
            continue;
          }
        } else {
          this.connect(middle, right);
        }
        this.size++;
      } else {
        if (curr.next) {
          this.connect(middle, curr.next);
        }
      }
      return;
    }
  }

  private insertBefore(node: Node<T>, before: Node<T>) {
    node.prev = before.prev;
    before.prev = node;
    node.next = before;
    if (node.prev) {
      node.prev.next = node;
    } else {
      this.head = node;
    }
  }

  private insertAfter(node: Node<T>, after: Node<T>) {
    node.next = after.next;
    after.next = node;
    node.prev = after;
    if (node.next) {
      node.next.prev = node;
    }
  }

  private connect(a: Node<T> | null, b: Node<T>) {
    if (a) {
      a.next = b;
      b.prev = a;
      if (!a.prev) {
        this.head = a;
      }
    } else {
      this.head = b;
    }
  }

  private node(from: number, to: number, value: ReadonlySet<T>): Node<T> {
    return {
      range: { from, to },
      value,
      prev: null,
      next: null,
    };
  }

  private intersection(current: Node<T>, newNode: Node<T>) {
    const a = current.range;
    const b = newNode.range;

    let left = null;
    let right = null;

    // Left
    if (a.from !== b.from) {
      left = this.node(
        Math.min(a.from, b.from),
        Math.max(a.from, b.from) - 1,
        this.clone(a.from < b.from ? current.value : newNode.value)
      );
    }

    // Middle (intersection)

    const middle = this.node(
      Math.max(a.from, b.from),
      Math.min(a.to, b.to),
      this.clone(current.value, newNode.value)
    );

    // Right
    if (a.to !== b.to) {
      right = this.node(
        Math.min(a.to, b.to) + 1,
        Math.max(a.to, b.to),
        this.clone(a.to < b.to ? newNode.value : current.value)
      );
    }

    return {
      left,
      middle,
      right,
    };
  }

  private clone(
    value: ReadonlySet<T>,
    newValue?: ReadonlySet<T>
  ): ReadonlySet<T> {
    const clone = new Set(value);
    if (newValue) {
      for (const v of newValue) {
        clone.add(v);
      }
    }
    return clone;
  }

  importFrom(data: MapRangeToSet<T>) {
    let current = data.head;
    while (current) {
      this.addRange(current.range.from, current.range.to, current.value);
      current = current.next;
    }
  }

  *[Symbol.iterator]() {
    let current = this.head;
    while (current) {
      yield [current.range, current.value] as const;
      current = current.next;
    }
  }
}
