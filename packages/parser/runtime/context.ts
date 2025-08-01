export class RuntimeContext {
  private stack: number[] = [];

  p<T>(id: number, fn: () => T): T {
    this.stack.push(id);
    const value = fn();
    this.stack.pop();
    return value;
  }

  ff(index: number) {
    return this.stack[this.stack.length - index] ?? -1;
  }

  c(b: boolean) {
    if (!b) {
      throw new Error("Predicate condition failed");
    }
  }
}
