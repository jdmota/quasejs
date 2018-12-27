import { Build } from "../builder";

interface IComputation {
  addDep( producer: Producer<unknown> ): void;
  invalidate(): void;
}

interface IComputationApi<T> {
  id: number;
  running: Promise<T>;
  computation: IComputation|null;
  didThrow: boolean;
  invalidate(): void;
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
    sub.addDep( this );
  }

  invalidate() {
    // Clear the subscriptions
    const subscribers = this.subscribers;
    this.subscribers = new Set();

    for ( const sub of subscribers ) {
      sub.invalidate();
    }
  }

  get( _: Build ): Promise<T> {
    throw new Error( "Abstract" );
  }

}

export class ComputationCancelled extends Error {

}

type Fn<C, E> = ( computation: C, build: Build ) => Promise<E>;

async function run<E, API extends IComputationApi<E>>(
  api: API, fn: Fn<API, E>, build: Build
) {
  try {
    const result = await fn( api, build );
    if ( api instanceof ComputationApiWithNested ) {
      api.setNested( api.nestedComputations );
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

abstract class AbstractComputationApi<T extends IComputation> {

  computation: T | null;

  constructor() {
    this.computation = null;
  }

  get<T>( dep: Producer<T>, build: Build ): Promise<T> {
    this.subscribeTo( dep );
    return dep.get( build );
  }

  subscribeTo( dep: Producer<unknown> ) {
    const computation = this.computation;
    if ( computation ) {
      dep.subscribe( computation );
    } else {
      throw new ComputationCancelled();
    }
  }

  invalidate() {
    const { computation } = this;
    if ( computation ) {
      this.computation = null;
      computation.invalidate();
    }
    throw new ComputationCancelled();
  }

}

abstract class AbstractComputation<E, T extends IComputationApi<E>> extends Producer<E> implements IComputation {

  dependencies: Set<Producer<unknown>>;
  version: T | null;

  constructor() {
    super();
    this.dependencies = new Set();
    this.version = null;
  }

  addDep( producer: Producer<unknown> ) {
    this.dependencies.add( producer );
  }

  get( build: Build ): Promise<E> {
    let { version } = this;

    if ( version ) {
      if ( !version.didThrow || version.id === build.buildId ) {
        return version.running;
      }
    }

    this.invalidate();
    version = this.version = this.newVersion( build );
    return version.running;
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

  abstract newVersion( _: Build ): T;

}

export class ComputationApi<T> extends AbstractComputationApi<Computation<T>> implements IComputationApi<T> {

  id: number;
  running: Promise<T>;
  didThrow: boolean;
  computation: Computation<T>|null;

  constructor( computation: Computation<T>, fn: Fn<ComputationApi<T>, T>, build: Build ) {
    super();
    this.id = build.buildId;
    this.computation = computation;
    this.didThrow = false;
    this.running = run( this, fn, build );
  }

}

export class ComputationApiWithNested<T, T2> extends AbstractComputationApi<ComputationWithNested<T, T2>> implements IComputationApi<T> {

  id: number;
  running: Promise<T>;
  didThrow: boolean;
  computation: ComputationWithNested<T, T2>|null;
  nestedComputations: Map<string, Computation<T2>>;

  constructor(
    computation: ComputationWithNested<T, T2>, fn: Fn<ComputationApiWithNested<T, T2>, T>, build: Build
  ) {
    super();
    this.id = build.buildId;
    this.computation = computation;
    this.didThrow = false;
    this.nestedComputations = new Map();
    this.running = run( this, fn, build );
  }

  setNested( nestedComputations: Map<string, Computation<T2>> ) {
    const { computation } = this;
    if ( computation ) {
      computation.nestedComputations = nestedComputations;
    }
  }

  newComputation( key: string, fn: Fn<ComputationApi<T2>, T2>, build: Build ): Promise<T2> {
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

export class Computation<T> extends AbstractComputation<T, ComputationApi<T>> {

  fn: Fn<ComputationApi<T>, T>;
  version: ComputationApi<T>|null;

  constructor( fn: Fn<ComputationApi<T>, T> ) {
    super();
    this.fn = fn;
    this.version = null;
  }

  newVersion( build: Build ): ComputationApi<T> {
    return new ComputationApi( this, this.fn, build );
  }

}

export class ComputationWithNested<T, T2> extends AbstractComputation<T, ComputationApiWithNested<T, T2>> {

  fn: Fn<ComputationApiWithNested<T, T2>, T>;
  version: ComputationApiWithNested<T, T2>|null;
  nestedComputations: Map<string, Computation<T2>>;

  constructor( fn: Fn<ComputationApiWithNested<T, T2>, T> ) {
    super();
    this.fn = fn;
    this.version = null;
    this.nestedComputations = new Map();
  }

  newVersion( build: Build ): ComputationApiWithNested<T, T2> {
    return new ComputationApiWithNested( this, this.fn, build );
  }

}
