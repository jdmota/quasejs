type Fn<T> = (data: T) => void;

export class Subscribable<T> {
  private subscribers: Set<Fn<T>>;

  constructor() {
    this.subscribers = new Set();
  }

  subscribe(fn: Fn<T>) {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  unsubscribe(fn: Fn<T>) {
    return this.subscribers.delete(fn);
  }

  emit(data: T) {
    for (const fn of this.subscribers) {
      fn(data);
    }
  }

  close() {
    this.subscribers.clear();
  }
}
