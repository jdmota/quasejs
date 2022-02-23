class ReactiveMapEntry<G extends Graph, V> extends Computation<G, V> {
  private innerValue: V;

  constructor(registry: ComputationRegistry<G>, value: V) {
    super(registry);
    this.innerValue = value;
  }

  setValue(value: V) {
    this.onValue(this.innerValue, value);
    this.innerValue = value;
  }

  getValue(): V {
    return this.innerValue;
  }

  protected async run(
    oldValue: V | null,
    runId: ComputationRunId
  ): Promise<ValOrError<V>> {
    return [this.innerValue, null];
  }
}

class JobPoolMapComputation<G extends Graph, K, V, V2> extends Computation<
  G,
  V
> {
  private readonly pool: JobPool<G, K, V>;
  private readonly mapper: (key: K, value: V) => V2;

  constructor(
    registry: ComputationRegistry<G>,
    pool: JobPool<G, K, V>,
    mapper: (key: K, value: V) => V2
  ) {
    super(registry);
    this.pool = pool;
    this.mapper = mapper;
  }

  protected async run(
    oldValue: V | null,
    runId: ComputationRunId
  ): Promise<ValOrError<V>> {
    return [null as any, null];
  }
}

class JobPool<G extends Graph, K, V> {
  private readonly registry: ComputationRegistry<G>;
  private readonly computations: Map<K, ReactiveMapEntry<G, V | undefined>>;
  private readonly prev: JobPool<G, K, V> | null;
  private readonly fn: (key: K) => V;

  constructor(
    registry: ComputationRegistry<G>,
    prev: JobPool<G, K, V> | null,
    fn: (key: K) => V
  ) {
    this.registry = registry;
    this.computations = new Map();
    this.prev = prev;
    this.fn = fn;
  }

  map<V2>(
    mapper: (key: K, value: V) => V2
  ): JobPoolMapComputation<G, K, V, V2> {
    return new JobPoolMapComputation(this.registry, this, mapper);
  }

  add(key: K, dep: Computation<G, any>) {
    const { fn } = this;
    let entry = this.computations.get(key);

    if (entry == null) {
      entry = new ReactiveMapEntry(this.registry, fn(key));
      this.computations.set(key, entry);
    }

    // Entry depends on the computations that added it
    dep.subscribe(entry);
  }
}
