import { createNotifier } from "../../../util/deferred";
import { HashMap, MapEvent, ValueDefinition } from "../../utils/hash-map";
import { ComputationResult } from "../../utils/result";
import { RunId } from "../../utils/run-id";
import { RawComputation } from "../raw";
import { ObserverComputation } from "./observer";

export type EmitterEvent<K, V, R> =
  | MapEvent<K, V>
  | Readonly<{
      type: "done";
      result: ComputationResult<R>;
    }>;

class ObservableHashMap<K, V> extends HashMap<K, V> {
  private readonly fn: (event: MapEvent<K, V>) => void;

  constructor(
    valueDef: ValueDefinition<K>,
    fn: (event: MapEvent<K, V>) => void
  ) {
    super(valueDef);
    this.fn = fn;
  }

  protected override changed(event: MapEvent<K, V>): void {
    super.changed(event);
    const { fn } = this;
    fn(event);
  }
}

export type EventFn<K, V, R> = (event: EmitterEvent<K, V, R>) => void;

export type EmitterContext<K, V, R> = {
  readonly emitSet: (key: K, value: V) => void;
  readonly emitRemove: (key: K) => void;
  readonly done: (result: ComputationResult<R>) => void;
};

export interface EmitterComputation<K, V, R> {
  readonly emitterMixin: EmitterComputationMixin<K, V, R>;
}

// Observers cannot see emitted values from deleted computations
// Because we can only delete the computation if we have zero observers
// And we cannot add observers to a deleted computation
// So it is fine to allow one to emit events even if the computation is not running

export class EmitterComputationMixin<K, V, R> {
  public readonly source: RawComputation<any, any> &
    EmitterComputation<K, V, R>;
  public readonly observers: Map<ObserverComputation, EventFn<K, V, R>>;
  private readonly results: HashMap<K, V>;
  private doneResult: ComputationResult<R> | null;
  private readonly notifier = createNotifier();
  private executed: boolean;
  private emitRunId: RunId;

  constructor(
    source: RawComputation<any, any> & EmitterComputation<K, V, R>,
    keyDef: ValueDefinition<K>,
    private readonly equals: (a: V, b: V) => boolean
  ) {
    this.source = source;
    this.observers = new Map();
    this.results = new ObservableHashMap<K, V>(keyDef, e => this.emitEvent(e));
    this.executed = false;
    this.doneResult = null;
    this.emitRunId = new RunId();
  }

  getResults() {
    return this.results;
  }

  getEmitRunId() {
    return this.emitRunId.getId();
  }

  newEmitRunId() {
    return this.emitRunId.newId();
  }

  cancelEmit() {
    this.emitRunId.cancel();
  }

  checkEmitActive(emitRunId: number) {
    if (this.emitRunId.isNotActive(emitRunId)) {
      throw new Error("Cannot emit in this state");
    }
  }

  makeContextRoutine(emitRunId: number): EmitterContext<K, V, R> {
    return {
      emitSet: (key, value) => this.emitSet(emitRunId, key, value),
      emitRemove: key => this.emitRemove(emitRunId, key),
      done: res => this.done(emitRunId, res),
    };
  }

  emitSet(emitRunId: number, key: K, value: V) {
    this.source.inv();
    this.checkEmitActive(emitRunId);
    this.results.set(key, value, this.equals);
  }

  emitRemove(emitRunId: number, key: K) {
    this.source.inv();
    this.checkEmitActive(emitRunId);
    this.results.delete(key);
  }

  private emitEvent(event: MapEvent<K, V>): void {
    this.setDone(null);
    for (const fn of this.observers.values()) {
      // TODO next tick?
      fn(event);
    }
  }

  done(emitRunId: number, result: ComputationResult<R>) {
    this.source.inv();
    this.checkEmitActive(emitRunId);
    this.setDone(result);
    for (const fn of this.observers.values()) {
      // TODO next tick?
      fn({
        type: "done",
        result,
      });
    }
  }

  private setDone(result: ComputationResult<R> | null) {
    if (this.doneResult !== result) {
      this.doneResult = result;
      if (this.notifier.isWaiting()) {
        if (result != null) {
          this.notifier.done(null);
        }
      } else if (this.executed) {
        this.source.invalidate();
      }
    }
  }

  emitInitialFor(observer: RawComputation<any, any> & ObserverComputation) {
    const fn = this.observers.get(observer);
    if (fn) {
      for (const [key, value] of this.results) {
        fn({
          type: "added",
          key,
          value,
          oldValue: undefined,
        });
      }
      if (this.doneResult != null) {
        fn({
          type: "done",
          result: this.doneResult,
        });
      }
    }
  }

  isOrphan(): boolean {
    return this.observers.size === 0;
  }

  invalidateRoutine() {
    this.executed = false;
    this.notifier.cancel();
  }

  resetRoutine() {
    this.cancelEmit();
    this.executed = false;
    this.notifier.cancel();
    this.results.clear();
    this.doneResult = null;
  }

  async exec(runId: number, emitRunId: number) {
    this.executed = true;
    // Wait for done...
    while (this.doneResult == null) {
      // Ensure this running version is active before doing side-effects
      this.source.checkActive(runId);
      this.checkEmitActive(emitRunId);
      await this.notifier.wait();
      // In case invalidations occured between notifier.done()
      // and this computation resuming, keep waiting if !isDone()
    }
    return this.doneResult;
  }
}
