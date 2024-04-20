export class RuntimeContext {
  private stack: number[] = [];

  p<T>(id: number, fn: () => T): T {
    this.stack.push(id);
    const value = fn();
    this.stack.pop();
    return value;
  }

  f(array: readonly number[]) {
    let i = this.stack.length - 1;
    let j = array.length - 1;
    if (i < j) {
      return false;
    }
    while (j >= 0) {
      if (this.stack[i] !== array[j]) {
        return false;
      }
      i--;
      j--;
    }
    return true;
  }
}
