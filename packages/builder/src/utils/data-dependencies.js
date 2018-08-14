// @flow

export interface IComputation {
  _depChanged(): void,
  _addDep( Producer<any> ): void // eslint-disable-line no-use-before-define
}

export class Producer<T> {

  subscribers: Set<IComputation>;

  constructor() {
    this.subscribers = new Set();
  }

  unsubscribe( sub: IComputation ) {
    this.subscribers.delete( sub );
  }

  subscribe( sub: IComputation ) {
    this.subscribers.add( sub );
    sub._addDep( this );
  }

  notify() {
    // Clear the subscriptions
    const subscribers = this.subscribers;
    this.subscribers = new Set();

    for ( const sub of subscribers ) {
      sub._depChanged();
    }

    return subscribers.size;
  }

  get(): Promise<T> {
    throw new Error( "Abstract" );
  }

}

export class Computation<T> extends Producer<T> implements IComputation {

  +fn: IComputation => Promise<T>;
  running: Promise<T> | null;
  dependencies: Set<Producer<any>>;

  constructor( fn: IComputation => Promise<T> ) {
    super();
    this.fn = fn;
    this.running = null;
    this.dependencies = new Set();
  }

  _addDep( producer: Producer<any> ) {
    this.dependencies.add( producer );
  }

  _depChanged() {
    this.running = null;

    const deps = this.dependencies;
    this.dependencies = new Set();

    for ( const dep of deps ) {
      dep.unsubscribe( this );
    }

    this.notify();
  }

  get( sub: ?IComputation ): Promise<T> {
    if ( sub ) {
      this.subscribe( sub );
    }

    const running = this.running;
    if ( running ) {
      return running;
    }

    const fn = this.fn;
    return ( this.running = fn( this ) );
  }

}
