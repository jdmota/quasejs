// @flow

export interface IComputation {
  invalidate(): void,
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

  invalidate() {
    // Clear the subscriptions
    const subscribers = this.subscribers;
    this.subscribers = new Set();

    for ( const sub of subscribers ) {
      sub.invalidate();
    }

    return subscribers.size;
  }

  get(): Promise<T> {
    throw new Error( "Abstract" );
  }

}

export class ComputationCancelled extends Error {

}

export class ComputationApi {

  parent: ?Computation<any>; // eslint-disable-line no-use-before-define

  constructor( parent: Computation<any> ) {
    this.parent = parent;
  }

  invalidate() {
    const parent = this.parent;
    if ( parent ) {
      this.parent = null;
      parent.invalidate();
    }
    throw new ComputationCancelled();
  }

  subscribeTo( dep: Producer<any> ) {
    const parent = this.parent;
    if ( parent ) {
      dep.subscribe( parent );
    } else {
      throw new ComputationCancelled();
    }
  }

  get<T>( dep: Producer<T> ): Promise<T> {
    this.subscribeTo( dep );
    return dep.get();
  }

}

export class Computation<T> extends Producer<T> implements IComputation {

  +fn: ( ComputationApi, any ) => Promise<T>;
  running: Promise<T> | null;
  dependencies: Set<Producer<any>>;
  version: ComputationApi;

  constructor( fn: ( ComputationApi, any ) => Promise<T> ) {
    super();
    this.fn = fn;
    this.running = null;
    this.dependencies = new Set();
    this.version = new ComputationApi( this );
  }

  _addDep( producer: Producer<any> ) {
    this.dependencies.add( producer );
  }

  invalidate() {
    if ( this.running ) {
      this.version.parent = null;
      this.version = new ComputationApi( this );
      this.running = null;

      const deps = this.dependencies;
      this.dependencies = new Set();

      for ( const dep of deps ) {
        dep.unsubscribe( this );
      }

      super.invalidate();
    }
  }

  get( arg: any ): Promise<T> {
    const running = this.running;
    if ( running ) {
      return running;
    }

    const fn = this.fn;
    const version = this.version;
    return ( this.running = fn( version, arg ).catch( err => {
      if ( err instanceof ComputationCancelled ) {
        version.invalidate();
      }
      throw err;
    } ) );
  }

}
