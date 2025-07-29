// Computations are functions
// They accept (immutable) arguments and produce results
// The arguments and results may be serialized and deserialized
// They may also be associated with equality functions to avoid unnecessary recomputations
// Since computations may be asynchronous, to ensure determinism, they may only depend on other computations and on the (immutable) arguments
import { SpecialQueue } from "../util/data-structures/linked-list";
import { Scheduler } from "../util/schedule";
import { assertion } from "../util/miscellaneous";
import { SerializationDB } from "../util/serialization";
import { HashMap } from "./utils/hash-map";
import { serializationDB } from "./utils/serialization-db";
import {
  type AnyRawComputation,
  RawComputation,
  State,
} from "./computations/raw";
import type {
  AnyComputationDescription,
  ComputationDescription,
} from "./computations/description";
import {
  type ComputationResult,
  type VersionedComputationResult,
} from "./utils/result";
import { CacheDB } from "./computations/mixins/cacheable";
import {
  type FileChangeEvent,
  FileSystem,
} from "./computations/file-system/file-system";
import { createErrorDefer } from "../util/deferred";
import { Logger } from "../util/logger";
import {
  type BasicComputationConfig,
  newComputationBuilder,
  newComputationBuilderNoReq,
} from "./computations/basic";
import {
  type ComputationPoolConfig,
  newComputationPool,
} from "./computations/job-pool/pool";
import {
  newStatefulComputation,
  type StatefulComputationConfig,
} from "./computations/stateful";

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

export type IncrementalCacheOpts = {
  readonly dir: string;
  readonly garbageCollect: boolean;
  readonly logger: Logger;
};

export type IncrementalOpts<C extends AnyRawComputation> = {
  readonly entry: ComputationDescription<C>;
  readonly onResult: (
    result: ComputationResult<ResultTypeOfComputation<C>>
  ) => void;
  readonly onUncaughtError: (
    info: Readonly<{
      description: ComputationDescription<any> | null;
      error: unknown;
    }>
  ) => void;
  readonly fs: {
    readonly onEvent: (event: FileChangeEvent) => void;
  };
  readonly cache: IncrementalCacheOpts | false;
};

type ComputationRegistryOpts<C extends AnyRawComputation> =
  IncrementalOpts<C> & {
    readonly canInvalidate: boolean;
  };

class ComputationRegistry<EntryC extends AnyRawComputation> {
  private canInvalidate: boolean;
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
  // Jobs like cleanup tasks that might not fit into the computation lifecycles
  private otherJobs: Promise<unknown>[];
  private globalSession: number = -1;

  public readonly db: CacheDB | null;
  public readonly fs: FileSystem;
  public readonly serializationDB: SerializationDB;

  private constructor(private readonly opts: ComputationRegistryOpts<EntryC>) {
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
    this.otherJobs = [];
    //
    this.serializationDB = serializationDB;
    this.db = opts.cache ? new CacheDB(opts.cache) : null;
    this.fs = new FileSystem(opts, this);
  }

  queueOtherJob(
    desc: ComputationDescription<any> | null,
    fn: () => Promise<unknown>
  ) {
    this.otherJobs.push(
      Promise.resolve()
        .then(fn)
        .catch(err => this.emitUncaughtError(desc, err))
    );
  }

  private emitUncaughtError(
    desc: ComputationDescription<any> | null,
    error: unknown
  ) {
    this.opts.onUncaughtError({ description: desc, error });
  }

  private computationsCount() {
    return this.map.size();
  }

  invalidationsAllowed() {
    return this.canInvalidate;
  }

  private disableInvalidations() {
    this.canInvalidate = false;
  }

  externalInvalidationsAllowed() {
    return this.canExternalInvalidate;
  }

  private disableExternalInvalidations() {
    this.canExternalInvalidate = false;
  }

  make<C extends AnyRawComputation>(
    desc: ComputationDescription<C>,
    root: boolean = false
  ): C {
    return this.map.computeIfAbsent(
      desc,
      () => desc.create(this).init(root) satisfies C
    ) as C;
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
    // in case they have no dependents, we use Array.from first,
    // also keeping in mind that "iterateAll" is not stable over modifications.
    let started = false;
    for (const c of Array.from(this.pending.iterateAll())) {
      started = c.maybeRun() || started;
    }
    return started;
  }

  // External invalidations (like those caused by file changes)
  // schedule invalidation of unstable computations
  // (those that errored with sporadic errors),
  // together with a new execution
  externalInvalidate(computation: AnyRawComputation) {
    if (this.externalInvalidationsAllowed()) {
      this.scheduler2.schedule();
      computation.invalidate();
    }
  }

  private invalidateSettledUnstable() {
    for (const c of this.settledUnstable.keepTaking()) {
      c.invalidate();
    }
  }

  private async wait() {
    assertion(!this.canInvalidate && !this.canExternalInvalidate);
    while (!this.pending.isEmpty() || !this.running.isEmpty()) {
      const started = this.wake();
      const computation = this.running.peek();
      if (computation) {
        await this.run(computation);
      } else if (!started) {
        // No running computation, and those that are pending did not start
        // (because they are lonely), let's break to avoid infinite loop
        break;
      }
    }
  }

  run<C extends AnyRawComputation>(
    computation: C
  ): Promise<VersionedComputationResult<ResultTypeOfComputation<C>>> {
    return Promise.race([computation.run(), this.interruptedDefer.promise]);
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

  // It is key that we only destroy computations that are not attached with anything
  // Also because of the cache information:
  // We do not want to get confused about the computation versions,
  // since destroying and then creating again a computation will effectively reset the version to 1
  private clearOrphans() {
    let count;
    do {
      count = this.computationsCount();
      for (const c of Array.from(this.map.values())) {
        c.maybeDestroy();
      }
    } while (this.computationsCount() < count);
  }

  private interruptedDefer = createErrorDefer();
  private cleaningUp = false;

  isCleaningUp() {
    return this.cleaningUp;
  }

  private cleanupRun(rootComputation: EntryC, interrupted: boolean) {
    if (this.cleaningUp) return;
    this.cleaningUp = true;
    this.interruptedDefer.reject(new Error("Interrupted"));

    this.scheduler1.cancel();
    this.scheduler2.cancel();

    // Basic clean up before locking the cache DB (preventing adding/deleting entries)
    this.clearOrphans();
    this.db?.lock();

    // Now clear everything
    rootComputation.setRoot(false);
    rootComputation.destroy();
    this.clearOrphans();

    if (this.computationsCount() > 0) {
      throw new Error("Invariant violation: Cleanup failed");
    }

    const { db, fs } = this;
    this.queueOtherJob(null, () => fs.close());
    if (db) this.queueOtherJob(null, () => db.save(interrupted));

    const { otherJobs } = this;
    this.otherJobs = [];
    return Promise.all(otherJobs);
  }

  getSession() {
    return this.globalSession;
  }

  async newSession() {
    if (this.db) {
      this.globalSession = await this.db.newGlobalSession();
    }
  }

  // TODO delete unneeed computations when stable?
  async gc() {
    await this.newSession();
    this.clearOrphans();
  }

  async load() {
    await this.newSession();
    return this;
  }

  callUserFn<Arg>(
    desc: AnyComputationDescription | null,
    fn: (arg: Arg) => void,
    arg: Arg
  ) {
    try {
      fn(arg);
    } catch (err) {
      this.emitUncaughtError(desc, err);
    }
  }

  onRootResult(
    result: VersionedComputationResult<ResultTypeOfComputation<EntryC>>
  ) {
    // Invalidations are disallowed when:
    // - in single run mode
    // - interrupted or finishing
    if (this.invalidationsAllowed()) {
      this.callUserFn(this.opts.entry, this.opts.onResult, result.result);
    }
  }

  static async singleRun<C extends AnyRawComputation>(
    opts: IncrementalOpts<C>
  ): Promise<ComputationResult<ResultTypeOfComputation<C>>> {
    const registry = await new ComputationRegistry({
      ...opts,
      canInvalidate: false,
    }).load();
    const computation = registry.make(opts.entry, true);
    const result = await registry.run(computation);
    await registry.cleanupRun(computation, false);
    return result.result;
  }

  static async run<C extends AnyRawComputation>(
    opts: IncrementalOpts<C>
  ): Promise<ComputationController<ResultTypeOfComputation<C>>> {
    const registry = await new ComputationRegistry<C>({
      ...opts,
      canInvalidate: true,
    }).load();
    const computation = registry.make(opts.entry, true);
    registry.wake();

    let interrupted = false;
    let finishing = false;

    return {
      async interrupt() {
        if (interrupted) throw new Error("Already interrupted");
        interrupted = true;
        registry.disableExternalInvalidations();
        registry.disableInvalidations();
        await registry.cleanupRun(computation, true);
      },
      async finish() {
        if (interrupted) throw new Error("Already interrupted");
        if (finishing) throw new Error("Already finishing");
        finishing = true;
        registry.disableExternalInvalidations();
        registry.invalidateSettledUnstable();
        registry.disableInvalidations();
        await registry.wait();
        const result = await registry.run(computation);
        await registry.cleanupRun(computation, false);
        return result.result;
      },
      peekErrors() {
        return registry.peekErrors();
      },
    };
  }
}

export type { ComputationRegistry };

type ComputationController<T> = {
  readonly interrupt: () => Promise<void>;
  readonly finish: () => Promise<ComputationResult<T>>;
  peekErrors(): {
    readonly deterministic: unknown[];
    readonly nonDeterministic: unknown[];
  };
};

export class IncrementalLib {
  static singleRun<C extends AnyRawComputation>(opts: IncrementalOpts<C>) {
    return ComputationRegistry.singleRun(opts);
  }

  static run<C extends AnyRawComputation>(opts: IncrementalOpts<C>) {
    return ComputationRegistry.run(opts);
  }

  static newBuilder<Req, Res>(config: BasicComputationConfig<Req, Res>) {
    return newComputationBuilder(config);
  }

  static new<Res>(config: BasicComputationConfig<undefined, Res>) {
    return newComputationBuilderNoReq(config);
  }

  static newPool<Req, Res>(config: ComputationPoolConfig<Req, Res>) {
    return newComputationPool(config);
  }

  static newStateful<K, V, R>(config: StatefulComputationConfig<K, V, R>) {
    return newStatefulComputation(config);
  }
}
