import { createGraphTemplate } from "./graph";

// https://github.com/adamhaile/S-array
// https://github.com/adamhaile/S
// https://github.com/solidjs/solid/blob/main/packages/solid/src/reactive/array.ts

// Dependencies:
// Read cell
// Write cell
// Create cell
// Call computation (arguments can be mutable stuff or incremental data structures)

// https://web.archive.org/web/20200724094204/http://skiplang.com/blog/2018/07/18/async-await.html
// «To preserve determinism, an async function can only take frozen (deeply immutable) parameters or Awaitables»

/*
ctx = {
  read(cell),
  write(cell, value),
  alloc(),
  call(computation, arguments)
}

To avoid circular dependencies, we can force each computation to state the types of computations it will depend on. This will force the computation classes to be defined before the ones that will depend on it.

Creating a computation inside another one is just moving the computation to the outer scope and having the context as an argument. So, this functionality is not needed.
*/

function transferSetItems<T>(a: Set<T>, b: Set<T>) {
  for (const e of a) {
    b.add(e);
  }
  a.clear();
}

type ValOrError<T, E = unknown> = readonly [T, null] | readonly [null, E];

enum ComputationEdges {
  READ,
  WRITE,
  ALLOC,
  CALL,
}

enum ComputationState {
  PENDING,
  RUNNING,
  ERRORED,
  DONE,
  DELETED,
}

type ComputationRunId = {
  readonly __opaque__: unique symbol;
};

class Cell<T> {
  readonly __type = "Cell";
}

class Computation<T> {
  readonly __type = "Computation";

  private readonly registry: ComputationRegistry;
  private state: ComputationState;
  private runId: ComputationRunId | null;
  private running: Promise<ValOrError<T>> | null;
  private value: T | null;
  private oldValue: T | null;
  private error: unknown;

  constructor(registry: ComputationRegistry) {
    this.registry = registry;
    this.state = ComputationState.PENDING;
    this.runId = null;
    this.running = null;
    this.value = null;
    this.oldValue = null;
    this.error = null;
  }

  protected equals(old: T, val: T) {
    return old === val;
  }

  subscribe(sub: Computation<G, any>) {
    this.subscribers.add(sub);
    this.oldSubscribers.delete(sub);
    sub.dependencies.add(this);
  }

  unsubscribe(sub: Computation<G, any>) {
    sub.dependencies.delete(this);
    this.subscribers.delete(sub);
    this.oldSubscribers.delete(sub);
  }

  invalidate() {
    transferSetItems(this.subscribers, this.oldSubscribers);
  }

  protected invalidateSubs(subs: ReadonlySet<Computation<G, any>>) {
    for (const sub of subs) {
      sub.invalidate();
    }
  }

  private after(result: ValOrError<T>, runId: ComputationRunId) {
    const [_value, err] = result;
    if (this.runId === runId) {
      if (err) {
        this.error = err;
        this.state = ComputationState.ERRORED;
      } else {
        const value = _value!;

        if (this.oldValue != null && this.equals(this.oldValue, value)) {
          transferSetItems(this.oldSubscribers, this.subscribers);
        } else {
          this.invalidateSubs(this.oldSubscribers);
        }

        this.value = value;
        this.oldValue = null;
        this.error = null;
        this.state = ComputationState.DONE;
      }
    }
    return result;
  }

  protected getDep<T>(
    dep: ComputationDependency<G, T>,
    runId: ComputationRunId
  ) {
    if (runId === this.runId) {
      dep.subscribe(this);
      return dep.get();
    }
    throw new Error("Computation was cancelled. Cannot get a new dependency.");
  }

  async get(): Promise<ValOrError<T>> {
    if (this.state === ComputationState.DELETED) {
      return [null, new Error("Cannot run a deleted computation")];
    }
    if (!this.running) {
      const runId = (this.runId = {} as ComputationRunId);
      this.state = ComputationState.RUNNING;
      this.running = this.run(this.oldValue, runId).then(
        v => this.after(v, runId),
        e => this.after([null, e], runId)
      );
    }
    return this.running;
  }

  invalidate() {
    this.state = ComputationState.PENDING;
    this.runId = null;
    this.running = null;
    this.error = null;
    this.value = null;
    this.disconnectFromDeps();
  }

  private disconnectFromDeps() {
    for (const dep of this.dependencies) {
      dep.unsubscribe(this);
    }
  }

  destroy() {
    if (this.state === ComputationState.DELETED) {
      return;
    }
    this.state = ComputationState.DELETED;
    this.runId = null;
    this.running = null;
    this.value = null;
    this.oldValue = null;
    this.error = null;
    this.disconnectFromDeps();
    this.invalidateSubs(this.oldSubscribers);
    this.invalidateSubs(this.subscribers);
  }
}

type Nodes = Computation<any> | Cell<any>;

const createGraph = createGraphTemplate<Nodes, ComputationEdges>();

export class ComputationRegistry {
  private graph: ReturnType<typeof createGraph>;

  constructor() {
    this.graph = createGraph();
  }

  newComputation() {
    const c = new Computation<any>(this);
    const n = this.graph.createNode(c);
    this.graph.addNode(n);
    return c;
  }

  newCell() {
    const c = new Cell<any>();
    const n = this.graph.createNode(c);
    this.graph.addNode(n);
    return c;
  }
}
