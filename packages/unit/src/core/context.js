// @flow

// Adapted from https://github.com/avajs/ava/pull/1657

export class ContextRef {

  value: Object;

  constructor() {
    this.value = {};
  }

  get(): Object {
    return this.value;
  }

  set( newValue: Object ) {
    this.value = newValue;
  }

  copy(): ContextRef {
    return new LateBinding( this ); // eslint-disable-line no-use-before-define
  }
}

export class LateBinding extends ContextRef {

  +ref: ContextRef;
  bound: boolean;

  constructor( ref: ContextRef ) {
    super();
    this.ref = ref;
    this.bound = false;
  }

  get(): Object {
    if ( !this.bound ) {
      this.set( Object.assign( {}, this.ref.get() ) );
    }
    return super.get();
  }

  set( newValue: Object ) {
    this.bound = true;
    super.set( newValue );
  }
}

class EmptyRef extends ContextRef {

  get(): Object {
    return {};
  }

  set( newValue: Object ) { // eslint-disable-line no-unused-vars

  }

  copy() {
    return this;
  }
}

export const EMPTY_REF = new EmptyRef();
