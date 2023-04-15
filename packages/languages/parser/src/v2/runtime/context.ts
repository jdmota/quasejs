export class RuntimeContext {
  private stack: number[] = [];

  u<T>(id: number, value: T): T {
    this.stack.push(id);
    return value;
  }

  o<T>(value: T): T {
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
      if (this.stack[i] != array[j]) {
        return false;
      }
      i--;
      j--;
    }
    return true;
  }
}
