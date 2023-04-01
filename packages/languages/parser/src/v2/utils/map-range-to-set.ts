import { allAfter, allBefore, Range } from "./range-utils";

export interface ReadonlySpecialSet<T> {
  [Symbol.iterator](): Iterator<T>;
}

export interface SpecialSet<T> extends ReadonlySpecialSet<T> {
  add(value: T): void;
}

type Node<T, S extends SpecialSet<T>> = {
  range: Range;
  value: Omit<S, "add">;
  prev: Node<T, S> | null;
  next: Node<T, S> | null;
};

type NotRangeSet = (readonly [number, number])[];

function rangeComparator(
  a: readonly [number, number],
  b: readonly [number, number]
) {
  return a[0] - b[0];
}

type NewSetFn<T, S extends SpecialSet<T>> = (range: Range) => S;

export class MapRangeToSpecialSet<T, S extends SpecialSet<T>> {
  private head: Node<T, S> | null;
  size: number;

  constructor(readonly newSet: NewSetFn<T, S>) {
    this.head = null;
    this.size = 0;
  }

  addNotRangeSet(
    set: NotRangeSet,
    value: Omit<S, "add">,
    MIN: number,
    MAX: number
  ) {
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

  addRange(from: number, to: number, value: Omit<S, "add">) {
    let curr = this.head;
    let node = this.node({ from, to }, value);

    if (curr == null) {
      this.head = node;
      this.size = 1;
      return;
    }

    while (true) {
      if (allBefore(node.range, curr.range)) {
        this.insertBefore(node, curr);
        this.size++;
        return;
      }

      if (allAfter(node.range, curr.range)) {
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
          if (allBefore(right.range, curr.next.range)) {
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

  private insertBefore(node: Node<T, S>, before: Node<T, S>) {
    node.prev = before.prev;
    before.prev = node;
    node.next = before;
    if (node.prev) {
      node.prev.next = node;
    } else {
      this.head = node;
    }
  }

  private insertAfter(node: Node<T, S>, after: Node<T, S>) {
    node.next = after.next;
    after.next = node;
    node.prev = after;
    if (node.next) {
      node.next.prev = node;
    }
  }

  private connect(a: Node<T, S> | null, b: Node<T, S>) {
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

  private node(range: Range, value: Omit<S, "add">): Node<T, S> {
    return {
      range,
      value,
      prev: null,
      next: null,
    };
  }

  private intersection(current: Node<T, S>, newNode: Node<T, S>) {
    const a = current.range;
    const b = newNode.range;

    let left = null;
    let right = null;

    // Left
    if (a.from !== b.from) {
      left = this.nodeWithClone(
        Math.min(a.from, b.from),
        Math.max(a.from, b.from) - 1,
        a.from < b.from ? current.value : newNode.value
      );
    }

    // Middle (intersection)

    const middle = this.nodeWithClone(
      Math.max(a.from, b.from),
      Math.min(a.to, b.to),
      current.value,
      newNode.value
    );

    // Right
    if (a.to !== b.to) {
      right = this.nodeWithClone(
        Math.min(a.to, b.to) + 1,
        Math.max(a.to, b.to),
        a.to < b.to ? newNode.value : current.value
      );
    }

    return {
      left,
      middle,
      right,
    };
  }

  private nodeWithClone(
    from: number,
    to: number,
    value: Omit<S, "add">,
    newValue?: Omit<S, "add">
  ) {
    const range: Range = { from, to };
    return this.node(range, this.clone(range, value, newValue));
  }

  private clone(
    range: Range,
    value: Omit<S, "add">,
    newValue?: Omit<S, "add">
  ): Omit<S, "add"> {
    const clone = this.newSet(range);
    for (const v of value) {
      clone.add(v);
    }
    if (newValue) {
      for (const v of newValue) {
        clone.add(v);
      }
    }
    return clone;
  }

  importFrom(data: MapRangeToSpecialSet<T, S>) {
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

export class MapRangeToSet<T> extends MapRangeToSpecialSet<T, Set<T>> {
  constructor() {
    super(() => new Set());
  }
}
