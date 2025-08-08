import { GraphNode, Graph } from "./graph";
import { LinkedList } from "./linked-list";
import { Diagnostic, createDiagnosticFromAny } from "./error";
import { ValOrError } from "../types";

/* eslint-disable @typescript-eslint/no-non-null-assertion */

enum State {
  PENDING,
  RUNNING,
  ERRORED,
  DONE,
  DELETED,
}

export const ComputationState = State;

export type ComputationRunId = {
  readonly __opaque__: unique symbol;
};

function transferSetItems<T>(a: Set<T>, b: Set<T>) {
  for (const e of a) {
    b.add(e);
  }
  a.clear();
}

export abstract class ComputationDependency<
  G extends Graph,
  T
> extends GraphNode<G> {
  protected subscribers: Set<Computation<G, any>>;
  protected oldSubscribers: Set<Computation<G, any>>;

  constructor(graph: G) {
    super(graph);
    this.subscribers = new Set();
    this.oldSubscribers = new Set();
  }

  protected equals(old: T, val: T) {
    return old === val;
  }

  protected onValue(old: T | null, val: T) {
    if (old != null && this.equals(old, val)) {
      transferSetItems(this.oldSubscribers, this.subscribers);
    } else {
      this.invalidateSubs(this.oldSubscribers);
    }
  }

  subscribe(sub: Computation<G, any>) {
    this.subscribers.add(sub);
    this.oldSubscribers.delete(sub);
    this.onInEdgeAddition();
  }

  unsubscribe(sub: Computation<G, any>) {
    this.subscribers.delete(sub);
    this.oldSubscribers.delete(sub);
    this.onInEdgeRemoval();
  }

  invalidate() {
    transferSetItems(this.subscribers, this.oldSubscribers);
    this.onInvalidate(null);
  }

  protected onInvalidate(_oldValue: T | null) {}

  protected invalidateSubs(subs: ReadonlySet<Computation<G, any>>) {
    for (const sub of subs) {
      sub.invalidate();
    }
  }

  isNodeOrphan() {
    return this.subscribers.size === 0 && this.oldSubscribers.size === 0;
  }

  protected onInEdgeAddition() {}

  protected onInEdgeRemoval() {
    if (this.isNodeOrphan()) {
      this.graph.removeNode(this);
    }
  }

  destroy() {
    this.invalidateSubs(this.oldSubscribers);
    this.invalidateSubs(this.subscribers);
    this.onDestroy();
  }

  protected onDestroy() {}

  abstract get(): Promise<ValOrError<T>>;
}

// TODO serialization?

export abstract class Computation<
  G extends Graph,
  T
> extends ComputationDependency<G, T> {
  protected registry: ComputationRegistry<G>;
  private state: State;
  private runId: ComputationRunId | null;
  private running: Promise<ValOrError<T>> | null;
  private value: T | null;
  private oldValue: T | null;
  private error: unknown;
  private dependencies: Set<ComputationDependency<G, any>>;

  constructor(registry: ComputationRegistry<G>) {
    super(registry.graph);
    this.registry = registry;
    this.state = State.PENDING;
    this.runId = null;
    this.running = null;
    this.value = null;
    this.oldValue = null;
    this.error = null;
    this.dependencies = new Set();
    this.mark(State.PENDING);
  }

  protected onInEdgeRemoval() {
    // TODO???? or schedule deletion...
    // Deleting unreferenced computations happens in "registry.run"
  }

  subscribe(sub: Computation<G, any>) {
    super.subscribe(sub);
    sub.dependencies.add(this);
  }

  unsubscribe(sub: Computation<G, any>) {
    sub.dependencies.delete(this);
    super.unsubscribe(sub);
  }

  peekValue() {
    if (this.value) {
      return this.value;
    }
    throw new Error("Assertion error: no value");
  }

  peekError() {
    if (this.error) {
      return this.error;
    }
    throw new Error("Assertion error: no error");
  }

  protected onDone(_val: T) {}

  private after(result: ValOrError<T>, runId: ComputationRunId) {
    const [_value, err] = result;
    if (this.runId === runId) {
      if (err) {
        this.error = err;
        this.mark(State.ERRORED);
      } else {
        const value = _value!;
        this.onValue(this.oldValue, value);
        this.value = value;
        this.oldValue = null;
        this.error = null;
        this.mark(State.DONE);

        this.onDone(value);
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
    if (this.state === State.DELETED) {
      return [null, new Error("Cannot run a deleted computation")];
    }
    if (!this.running) {
      const runId = (this.runId = {} as ComputationRunId);
      this.mark(State.RUNNING);
      this.running = this.run(this.oldValue, runId).then(
        v => this.after(v, runId),
        e => this.after([null, e], runId)
      );
    }
    return this.running;
  }

  protected abstract run(
    oldValue: T | null,
    runId: ComputationRunId
  ): Promise<ValOrError<T>>;

  /*protected onInvalidate(oldValue: T | null) {
    this.oldValue = oldValue;
  }*/

  invalidate() {
    this.mark(State.PENDING);

    const { value } = this;
    this.runId = null;
    this.running = null;
    this.error = null;
    this.value = null;
    if (value) {
      this.onInvalidate(value);
    }
    this.disconnectFromDeps();
    super.invalidate();
  }

  private disconnectFromDeps() {
    for (const dep of this.dependencies) {
      dep.unsubscribe(this);
    }
  }

  destroy() {
    if (this.state === State.DELETED) {
      return;
    }
    this.mark(State.DELETED);
    this.runId = null;
    this.running = null;
    this.value = null;
    this.oldValue = null;
    this.error = null;
    this.disconnectFromDeps();
    super.destroy();
  }

  private mark(state: State) {
    if (this.state === State.DELETED) {
      return;
    }
    this.registry.computations[this.state].delete(this);
    if (state !== State.DELETED) {
      this.registry.computations[state].add(this);
    }
    this.state = state;
  }

  runOrDel() {
    if (this.isNodeOrphan()) {
      this.graph.removeNode(this);
    } else {
      this.get();
    }
  }
}

export class ComputationRegistry<G extends Graph> {
  readonly graph: G;
  readonly computations: readonly [
    Set<Computation<G, any>>,
    Set<Computation<G, any>>,
    Set<Computation<G, any>>,
    Set<Computation<G, any>>
  ];
  private pending: Set<Computation<G, any>>;
  private errored: Set<Computation<G, any>>;
  private running: Set<Computation<G, any>>;
  private interrupted: boolean;
  private otherPromises: LinkedList<Promise<Diagnostic | void>>;

  constructor(graph: G) {
    this.graph = graph;
    this.computations = [new Set(), new Set(), new Set(), new Set()];
    this.pending = this.computations[State.PENDING];
    this.errored = this.computations[State.ERRORED];
    this.running = this.computations[State.RUNNING];
    this.interrupted = false;
    this.otherPromises = new LinkedList();
  }

  addOtherJob(
    prev: Promise<Diagnostic | void> = Promise.resolve(),
    fn: () => void
  ) {
    const next = prev.then(fn).catch(createDiagnosticFromAny);
    this.otherPromises.add(next);
    return next;
  }

  interrupt() {
    this.interrupted = true;
  }

  wasInterrupted() {
    return this.interrupted;
  }

  private hasPending() {
    return (
      !this.interrupted && (this.pending.size > 0 || this.running.size > 0)
    );
  }

  // TODO topological order
  // maybe do one pass first to mark as MAYBE_DIRTY
  // what if a computation is running and adds a NEW dependency on something that is MAYBE_DIRTY? needs to wait?
  async run() {
    const errors: Diagnostic[] = [];

    this.interrupted = false;

    for (const c of this.errored) {
      c.invalidate();
    }

    while (this.hasPending()) {
      for (const c of this.pending) {
        c.runOrDel();
      }

      for (const c of this.running) {
        await c.get();
        break;
      }
    }

    for (const c of this.errored) {
      errors.push(createDiagnosticFromAny(c.peekError()));
    }

    if (this.interrupted) {
      return errors;
    }

    for (const otherPromise of this.otherPromises.iterateAndRemove()) {
      const error = await otherPromise;
      if (error) errors.push(error);

      if (this.interrupted) {
        return errors;
      }
    }

    return errors;
  }
}
