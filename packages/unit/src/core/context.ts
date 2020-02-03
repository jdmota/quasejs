// Adapted from https://github.com/avajs/ava/pull/1657

export class ContextRef {
  private value: any;

  constructor() {
    this.value = {};
  }

  get(): any {
    return this.value;
  }

  set(newValue: any) {
    this.value = newValue;
  }

  copy(): ContextRef {
    return new LateBinding(this); // eslint-disable-line no-use-before-define
  }
}

export class LateBinding extends ContextRef {
  private ref: ContextRef;
  private bound: boolean;

  constructor(ref: ContextRef) {
    super();
    this.ref = ref;
    this.bound = false;
  }

  get(): any {
    if (!this.bound) {
      this.set(Object.assign({}, this.ref.get()));
    }
    return super.get();
  }

  set(newValue: any) {
    this.bound = true;
    super.set(newValue);
  }
}

class EmptyRef extends ContextRef {
  get(): any {
    return {};
  }

  set(_newValue: any) {}

  copy() {
    return this;
  }
}

export const EMPTY_REF = new EmptyRef();
