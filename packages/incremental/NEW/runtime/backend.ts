import { SpecialQueue } from "../../../util/data-structures/linked-list";
import type { Logger } from "../../../util/logger";
import { Scheduler } from "../../../util/schedule";
import { createErrorDefer } from "../../../util/deferred";
import { HashMap } from "../../utils/hash-map";
import type { Version } from "../../utils/versions";
import { type FileChangeEvent, FileSystem } from "../file-system/file-system";
import type {
  AnyIncrementalComputationDescription,
  IncrementalComputationDescription,
} from "../descriptions/computations";
import { functions } from "../descriptions/functions";
import type {
  IncrementalCellDescription,
  IncrementalCellOwnerDescription,
} from "../descriptions/cells";
import { State, type IncrementalComputationRuntime } from "./computations";
import type { IncrementalCellRuntime } from "./cells";

export type IncrementalCacheOpts = {
  readonly dir: string;
  readonly garbageCollect: boolean;
  readonly logger: Logger;
};

export type IncrementalOpts = {
  // readonly entry: ComputationDescription<C>;
  readonly onUncaughtError: (
    info: Readonly<{
      description: AnyIncrementalComputationDescription | null;
      error: unknown;
    }>
  ) => void;
  readonly fs: {
    readonly onEvent: (event: FileChangeEvent) => void;
  };
  readonly cache: IncrementalCacheOpts | false;
  readonly canInvalidate: boolean;
};

export class IncrementalBackend {
  public static functions = functions;

  private map: HashMap<
    IncrementalCellOwnerDescription,
    IncrementalComputationRuntime<any, any>
  >;
  readonly computations: readonly [
    SpecialQueue<IncrementalComputationRuntime<any, any>>,
    SpecialQueue<IncrementalComputationRuntime<any, any>>,
    SpecialQueue<IncrementalComputationRuntime<any, any>>,
    SpecialQueue<IncrementalComputationRuntime<any, any>>,
  ];
  private sessionVersion = 0;
  private nextVersion = 0;
  private canInvalidate: boolean;
  private canExternalInvalidate: boolean;
  private readonly pending: SpecialQueue<
    IncrementalComputationRuntime<any, any>
  >;
  private readonly running: SpecialQueue<
    IncrementalComputationRuntime<any, any>
  >;
  private readonly settledErr: SpecialQueue<
    IncrementalComputationRuntime<any, any>
  >;
  // Jobs like cleanup tasks that might not fit into the computation lifecycles
  private otherJobs: Promise<unknown>[];
  public readonly fs: FileSystem;

  constructor(private readonly opts: IncrementalOpts) {
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
    this.canInvalidate = opts.canInvalidate;
    this.canExternalInvalidate = opts.canInvalidate;
    this.pending = this.computations[State.PENDING];
    this.running = this.computations[State.RUNNING];
    this.settledErr = this.computations[State.SETTLED_ERR];
    this.otherJobs = [];
    this.fs = new FileSystem(opts, this);
  }

  callUserFn<Arg>(
    desc: AnyIncrementalComputationDescription | null,
    fn: (arg: Arg) => void,
    arg: Arg
  ) {
    try {
      fn(arg);
    } catch (err) {
      this.emitUncaughtError(desc, err);
    }
  }

  queueOtherJob(
    desc: AnyIncrementalComputationDescription | null,
    fn: () => Promise<unknown>
  ) {
    this.otherJobs.push(
      Promise.resolve()
        .then(fn)
        .catch(err => this.emitUncaughtError(desc, err))
    );
  }

  private emitUncaughtError(
    desc: AnyIncrementalComputationDescription | null,
    error: unknown
  ) {
    this.opts.onUncaughtError({ description: desc, error });
  }

  getCell<Value>(
    desc: IncrementalCellDescription<Value>
  ): IncrementalCellRuntime<Value> | undefined {
    return this.map.get(desc.owner)?.getCell(desc);
  }

  make<C extends IncrementalComputationRuntime<any, any>>(
    desc: IncrementalComputationDescription<C>,
    root: boolean = false
  ): C {
    return this.map.computeIfAbsent(
      desc,
      () => desc.create(this).init(root) satisfies C
    ) as C;
  }

  delete(c: IncrementalComputationRuntime<any, any>) {
    this.map.delete(c.rawDesc);
  }

  getNextVersion(): Version {
    // 0: Distinguish between different sessions
    // 1: Distinguish between different versions in this session
    // (we rely on a global value to ensure that even
    // deleted then recreated computations have different versions)
    return [this.sessionVersion, this.nextVersion++];
  }

  onFunctionError(
    description: AnyIncrementalComputationDescription,
    error: unknown
  ) {
    this.opts.onUncaughtError({
      description,
      error,
    });
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

  private scheduler1 = new Scheduler(() => this.wake(), 100);
  private scheduler2 = new Scheduler(() => {
    this.invalidateSettledErr();
    this.wake();
  }, 200);

  scheduleWake() {
    this.scheduler1.schedule();
  }

  wake() {
    this.scheduler1.cancel();
    // TODO FIXME

    // Since invalidations of a computation:
    // - do not immediately invalidate the subscribers
    // - immediately disconnect it from dependencies
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
  // schedule invalidation of errored computations
  // together with a new execution
  externalInvalidate(computation: IncrementalComputationRuntime<any, any>) {
    if (this.externalInvalidationsAllowed()) {
      this.scheduler2.schedule();
      computation.invalidate();
    }
  }

  private invalidateSettledErr() {
    for (const c of this.settledErr.keepTaking()) {
      c.invalidate();
    }
  }

  private async wait() {
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

  run<Ctx, Output>(
    computation: IncrementalComputationRuntime<Ctx, Output>
  ): Promise<void> {
    return Promise.race([computation.run(), this.interruptedDefer.promise]);
  }

  private interruptedDefer = createErrorDefer();
  private cleaningUp = false;

  isCleaningUp() {
    return this.cleaningUp;
  }

  private cleanupRun(interrupted: boolean) {
    if (this.cleaningUp) return;
    this.cleaningUp = true;
    this.interruptedDefer.reject(new Error("Interrupted"));

    this.scheduler1.cancel();
    this.scheduler2.cancel();

    // Basic clean up before locking the cache DB (preventing adding/deleting entries)
    /* this.clearOrphans();
    this.db?.lock(); */

    // Now clear everything
    /* rootComputation.setRoot(false);
    rootComputation.destroy();
    this.clearOrphans();

    if (this.computationsCount() > 0) {
      throw new Error("Invariant violation: Cleanup failed");
    } */

    const { /* db, */ fs } = this;
    this.queueOtherJob(null, () => fs.close());
    // if (db) this.queueOtherJob(null, () => db.save(interrupted));

    const { otherJobs } = this;
    this.otherJobs = [];
    return Promise.all(otherJobs);
  }

  close() {
    // TODO
    return this.cleanupRun(false);
  }
}
