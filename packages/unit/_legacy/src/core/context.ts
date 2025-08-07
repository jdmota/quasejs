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
    return new LateBinding(this);
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

  override get(): any {
    if (!this.bound) {
      this.set(Object.assign({}, this.ref.get()));
    }
    return super.get();
  }

  override set(newValue: any) {
    this.bound = true;
    super.set(newValue);
  }
}

class EmptyRef extends ContextRef {
  override get(): any {
    return {};
  }

  override set(_newValue: any) {}

  override copy() {
    return this;
  }
}

export const EMPTY_REF = new EmptyRef();
