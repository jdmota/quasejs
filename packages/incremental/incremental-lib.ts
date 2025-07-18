// Computations are functions
// They accept (immutable) arguments and produce results
// The arguments and results may be serialized and deserialized
// They may also be associated with equality functions to avoid unnecessary recomputations
// Since computations may be asynchronous, to ensure determinism, they may only depend on other computations and on the (immutable) arguments
import EventEmitter from "node:events";
import { SpecialQueue } from "../util/data-structures/linked-list";
import { Scheduler } from "../util/schedule";
import { HashMap } from "./utils/hash-map";
import { AnyRawComputation, RawComputation, State } from "./computations/raw";
import { ComputationResult } from "./utils/result";
import {
  SimpleEffectComputationExec,
  newSimpleEffectComputation,
} from "./computations/simple-effect";
import { EffectComputation } from "./computations/effect";
import { CacheDB } from "./computations/mixins/cacheable";
import { FileSystem } from "./computations/file-system/file-system";
import { SerializationDB } from "../util/serialization";

const determinismSym = Symbol("deterministic");

type DeterministicFunc<Arg, Ret> = {
  readonly [determinismSym]: (arg: Arg) => Ret;
};

function deterministic<Arg, Ret>(
  func: (arg: Arg) => Ret
): DeterministicFunc<Arg, Ret> {
  return {
    [determinismSym]: func,
  };
}

export type ResultTypeOfComputation<C> =
  C extends RawComputation<any, infer Res> ? Res : never;

export type ComputationDescription<C extends AnyRawComputation> = {
  readonly create: (registry: ComputationRegistry) => C;
  readonly equal: <O extends AnyRawComputation>(
    other: ComputationDescription<O>
  ) => boolean;
  readonly hash: () => number;
};

export type AnyComputationDescription =
  ComputationDescription<AnyRawComputation>;

type ComputationRegistryOpts = {
  readonly canInvalidate: boolean;
  readonly cacheDir: string;
};

export type ComputationRegistryEvents = {
  uncaughtError: [
    Readonly<{
      description: ComputationDescription<any>;
      error: unknown;
    }>,
  ];
};

export type IncrementalOpts = {
  readonly cacheDir: string;
};

export const serializationDB = new SerializationDB();

export class ComputationRegistry extends EventEmitter<ComputationRegistryEvents> {
  private readonly canInvalidate: boolean;
  private canExternalInvalidate: boolean;
  private map: HashMap<ComputationDescription<any>, AnyRawComputation>;
  readonly computations: readonly [
    SpecialQueue<AnyRawComputation>,
    SpecialQueue<AnyRawComputation>,
    SpecialQueue<AnyRawComputation>,
    SpecialQueue<AnyRawComputation>,
  ];
  private readonly pending: SpecialQueue<AnyRawComputation>;
  private readonly running: SpecialQueue<AnyRawComputation>;
  private readonly settledUnstable: SpecialQueue<AnyRawComputation>;
  private otherJobs: Promise<unknown>[];

  public readonly db: CacheDB;
  public readonly fs: FileSystem;

  private constructor(opts: ComputationRegistryOpts) {
    super();
    this.canInvalidate = opts.canInvalidate;
    this.canExternalInvalidate = opts.canInvalidate;
    this.map = new HashMap({
      equal: (a, b) => a.equal(b),
      hash: a => a.hash(),
    });
    this.computations = [
      new SpecialQueue(),
      new SpecialQueue(),
      new SpecialQueue(),
      new SpecialQueue(),
    ];
    this.pending = this.computations[State.PENDING];
    this.running = this.computations[State.RUNNING];
    this.settledUnstable = this.computations[State.SETTLED_UNSTABLE];
    this.otherJobs = []; // This includes jobs like cleanup tasks that might not fit into the computation lifecycles
    //
    this.db = new CacheDB(opts.cacheDir, serializationDB);
    this.fs = new FileSystem();
  }

  queueOtherJob(fn: () => Promise<unknown>) {
    this.otherJobs.push(Promise.resolve().then(fn));
  }

  emitUncaughtError(description: ComputationDescription<any>, error: unknown) {
    if (this.listenerCount("uncaughtError") > 0) {
      this.emit("uncaughtError", { description, error });
    } else {
      throw error;
    }
  }

  private computationsCount() {
    return this.map.size();
  }

  invalidationsAllowed() {
    return this.canInvalidate;
  }

  externalInvalidationsAllowed() {
    return this.canExternalInvalidate;
  }

  private disableExternalInvalidations() {
    this.canExternalInvalidate = false;
  }

  make<C extends AnyRawComputation>(description: ComputationDescription<C>): C {
    return this.map.computeIfAbsent(description, d => d.create(this)) as C;
  }

  delete(c: AnyRawComputation) {
    this.map.delete(c.description);
  }

  private scheduler1 = new Scheduler(() => this.wake(), 100);
  private scheduler2 = new Scheduler(() => {
    this.invalidateSettledUnstable();
    this.wake();
  }, 200);

  scheduleWake() {
    this.scheduler1.schedule();
  }

  wake() {
    this.scheduler1.cancel();

    // Since invalidations of a computation:
    // - do not immediately invalidate the subscribers and
    // - disconnect it from dependencies
    // and since there is memoing,
    // we actually do not need to start these in topological order.
    // Since some computations might not be removed from the "pending" set,
    // in case they have no dependents, we use Array.from first.
    for (const c of Array.from(this.pending.iterateAll())) {
      c.maybeRun();
    }
  }

  // External invalidations (like those caused by file changes)
  // schedule invalidation of unstable computations
  // (those that errored with sporadic errors),
  // together with a new execution
  externalInvalidate(computation: AnyRawComputation) {
    if (this.externalInvalidationsAllowed()) {
      computation.invalidate();
      this.scheduler2.schedule();
    }
  }

  private invalidateSettledUnstable() {
    for (const c of this.settledUnstable.keepTaking()) {
      c.invalidate();
    }
  }

  private async wait() {
    while (!this.pending.isEmpty() || !this.running.isEmpty()) {
      this.wake();
      await this.running.peek()?.run();
    }
  }

  peekErrors() {
    const deterministic = [];
    const nonDeterministic = [];
    for (const c of this.computations[State.SETTLED_STABLE].iterateAll()) {
      const res = c.peekResult();
      if (!res.ok) {
        if (res.deterministic) {
          deterministic.push(res.error);
        } else {
          nonDeterministic.push(res.error);
        }
      }
    }
    for (const c of this.computations[State.SETTLED_UNSTABLE].iterateAll()) {
      const res = c.peekError();
      if (res.deterministic) {
        deterministic.push(res.error);
      } else {
        nonDeterministic.push(res.error);
      }
    }
    return {
      deterministic,
      nonDeterministic,
    };
  }

  // TODO The computations also have an implementation version so that results cached in disk can be invalidated if the plugin gets a new version?
  // TODO To avoid circular dependencies, we can force each computation to state the types of computations it will depend on. This will force the computation classes to be defined before the ones that will depend on it.

  // TODO peek errors and return a list of them? create a error pool and report only those?
  /*
    for (const c of this.errored.iterateAll()) {
      errors.push(c.peekError());
    }
  */

  // TODO delete unneeed computations during execution?

  // It is key that we only destroy computations that are not attached with anything
  // Also because of the cache information:
  // We do not want to get confused about the computation versions,
  // since destroying and they creating again a computation will effectively reset the version to 1
  private clearOrphans() {
    let count;
    do {
      count = this.computationsCount();
      for (const c of Array.from(this.map.values())) {
        c.maybeDestroy();
      }
    } while (this.computationsCount() < count);
  }

  private cleanupRun(computation: EffectComputation<undefined, any>) {
    this.scheduler1.cancel();
    this.scheduler2.cancel();

    // Basic clean up before locking the cache DB (preventing adding/deleting entries)
    this.clearOrphans();
    this.db.lock();

    // Now clear everything
    computation.unroot();
    computation.destroy();
    this.clearOrphans();

    if (this.computationsCount() > 0) {
      throw new Error("Invariant violation: Cleanup failed");
    }

    this.queueOtherJob(() => this.fs.close());
    this.queueOtherJob(() => this.db.save());

    const { otherJobs } = this;
    this.otherJobs = [];
    return Promise.all(otherJobs);
  }

  static async singleRun<T>(
    exec: SimpleEffectComputationExec<T>,
    opts: IncrementalOpts
  ): Promise<ComputationResult<T>> {
    const registry = new ComputationRegistry({
      cacheDir: opts.cacheDir,
      canInvalidate: false,
    });
    const desc = newSimpleEffectComputation({ exec, root: true });
    const computation = registry.make(desc);
    const result = await computation.run();
    await registry.cleanupRun(computation);
    return result.result;
  }

  static run<T>(
    exec: SimpleEffectComputationExec<T>,
    opts: IncrementalOpts
  ): ComputationController<T> {
    const registry = new ComputationRegistry({
      cacheDir: opts.cacheDir,
      canInvalidate: true,
    });
    const desc = newSimpleEffectComputation({ exec, root: true });
    const computation = registry.make(desc);
    registry.wake();

    let interrupted = false;
    let finishing = false;

    return {
      async interrupt() {
        if (interrupted) throw new Error("Already interrupted");
        interrupted = true;
        await registry.cleanupRun(computation);
      },
      async finish() {
        if (interrupted) throw new Error("Already interrupted");
        if (finishing) throw new Error("Already finishing");
        finishing = true;
        registry.disableExternalInvalidations();
        registry.invalidateSettledUnstable();
        await registry.wait();
        const result = await computation.run();
        await registry.cleanupRun(computation);
        return result.result;
      },
      peekErrors() {
        return registry.peekErrors();
      },
    };
  }
}

type ComputationController<T> = {
  readonly interrupt: () => Promise<void>;
  readonly finish: () => Promise<ComputationResult<T>>;
  peekErrors(): {
    readonly deterministic: unknown[];
    readonly nonDeterministic: unknown[];
  };
};
