type GetFn = <T>( p: Producer<T> ) => Promise<T>;
type Fn<T> = ( get: GetFn, buildId: number ) => Promise<T>;

export type ComputationGet = GetFn;

export type SoloProducer<T> = {
  readonly _solo: true;
  subscribers: Set<Computation<unknown>>;
  get: () => Promise<T>;
};

type ComputationApi<T> = {
  readonly id: number;
  running: Promise<T> | null;
  didThrow: boolean;
  computation: Computation<T> | null;
};

export type Computation<T> = {
  readonly _solo: false;
  subscribers: Set<Computation<unknown>>;
  dependencies: Set<Producer<unknown>>;
  version: ComputationApi<T> | null;
  readonly fn: Fn<T>;
};

type Producer<T> = SoloProducer<T> | Computation<T>;

export class ComputationCancelled extends Error {

}

export function isComputationCancelled( x: unknown ): x is ComputationCancelled {
  return x instanceof ComputationCancelled;
}

export function createProducer<T>( get: () => Promise<T> ): SoloProducer<T> {
  return {
    _solo: true,
    subscribers: new Set(),
    get
  };
}

export function unsubscribe( producer: Producer<unknown>, sub: Computation<unknown> ) {
  return producer.subscribers.delete( sub );
}

export function subscribe( producer: Producer<unknown>, sub: Computation<unknown> ) {
  producer.subscribers.add( sub );
  sub.dependencies.add( producer );
}

export function invalidate( producer: Producer<unknown> ) {
  // Clear the subscriptions
  const subscribers = producer.subscribers;
  producer.subscribers = new Set();

  for ( const sub of subscribers ) {
    computationInvalidate( sub );
  }
}

function createComputationApi<T>( computation: Computation<T>, buildId: number ): ComputationApi<T> {
  return {
    id: buildId,
    running: null,
    didThrow: false,
    computation
  };
}

function apiGet<T, T2>( api: ComputationApi<T>, buildId: number, dep: Producer<T2> ): Promise<T2> {
  const computation = api.computation;
  if ( computation ) {
    subscribe( dep, computation );
  } else {
    throw new ComputationCancelled();
  }
  return dep._solo ? dep.get() : computationGet( dep, buildId );
}

export function createComputation<T>( fn: Fn<T> ): Computation<T> {
  return {
    _solo: false,
    subscribers: new Set(),
    dependencies: new Set(),
    version: null,
    fn
  };
}

export function computationInvalidate( computation: Computation<unknown> ) {
  const { version } = computation;

  if ( version ) {
    version.computation = null;
    computation.version = null;

    const deps = computation.dependencies;
    computation.dependencies = new Set();

    for ( const dep of deps ) {
      unsubscribe( dep, computation );
    }

    invalidate( computation );
  }
}

async function run<T>( api: ComputationApi<T>, fn: Fn<T>, buildId: number ) {
  try {
    return await fn( apiGet.bind( null, api, buildId ) as GetFn, buildId );
  } catch ( err ) {
    api.didThrow = true;
    throw err;
  }
}

export function computationGet<T>( computation: Computation<T>, buildId: number ): Promise<T> {
  let { version } = computation;
  let running;

  if ( version ) {
    if ( version.running && ( !version.didThrow || version.id === buildId ) ) {
      return version.running;
    }
    computationInvalidate( computation as Computation<unknown> );
  }

  version = computation.version = createComputationApi( computation, buildId );
  running = version.running = run( version, computation.fn, buildId );
  return running;
}
