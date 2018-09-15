// @flow
import type { Build } from "../builder";

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

  get( _: Build ): Promise<T> {
    throw new Error( "Abstract" );
  }

}

export class ComputationCancelled extends Error {

}

async function run( api: ComputationApi, fn: ( ComputationApi, Build ) => Promise<any>, build: Build ) {
  try {
    const result = await fn( api, build );
    const { computation } = api;
    if ( computation ) {
      computation.nestedComputations = api.nestedComputations;
    }
    return result;
  } catch ( err ) {
    if ( err instanceof ComputationCancelled ) {
      api.invalidate();
    }
    api.didThrow = true;
    throw err;
  }
}

export class ComputationApi {

  +id: number;
  +running: Promise<any>;
  computation: ?Computation<any>; // eslint-disable-line no-use-before-define
  nestedComputations: Map<string, Computation<any>>; // eslint-disable-line no-use-before-define
  didThrow: boolean;

  constructor( computation: Computation<any>, fn: ( ComputationApi, Build ) => Promise<any>, build: Build ) {
    this.id = build.buildId;
    this.computation = computation;
    this.nestedComputations = new Map();
    this.didThrow = false;
    this.running = run( this, fn, build );
  }

  invalidate() {
    const { computation } = this;
    if ( computation ) {
      this.computation = null;
      computation.invalidate();
    }
    throw new ComputationCancelled();
  }

  subscribeTo( dep: Producer<any> ) {
    const computation = this.computation;
    if ( computation ) {
      dep.subscribe( computation );
    } else {
      throw new ComputationCancelled();
    }
  }

  get<T>( dep: Producer<T>, build: Build ): Promise<T> {
    this.subscribeTo( dep );
    return dep.get( build );
  }

  newComputation<E>( key: string, fn: ( ComputationApi, Build ) => Promise<E>, build: Build ): Promise<E> {
    const { computation } = this;
    if ( computation ) {
      const currNested = this.nestedComputations.get( key );
      const nested = currNested || computation.nestedComputations.get( key ) || new Computation( fn );
      if ( !currNested ) {
        this.nestedComputations.set( key, nested );
      }
      return this.get( nested, build );
    }
    throw new ComputationCancelled();
  }

}

export class Computation<T> extends Producer<T> implements IComputation {

  +fn: ( ComputationApi, Build ) => Promise<T>;
  nestedComputations: Map<string, Computation<any>>;
  dependencies: Set<Producer<any>>;
  version: ?ComputationApi;

  constructor( fn: ( ComputationApi, Build ) => Promise<T> ) {
    super();
    this.fn = fn;
    this.version = null;
    this.dependencies = new Set();
    this.nestedComputations = new Map();
  }

  _addDep( producer: Producer<any> ) {
    this.dependencies.add( producer );
  }

  invalidate() {
    const { version } = this;

    if ( version ) {
      version.computation = null;
      this.version = null;

      const deps = this.dependencies;
      this.dependencies = new Set();

      for ( const dep of deps ) {
        dep.unsubscribe( this );
      }

      super.invalidate();
    }
  }

  get( build: Build ): Promise<T> {
    let { version } = this;

    if ( version ) {
      if ( !version.didThrow || version.id === build.buildId ) {
        return version.running;
      }
    }

    this.invalidate();
    version = this.version = new ComputationApi( this, this.fn, build );
    return version.running;
  }

}
