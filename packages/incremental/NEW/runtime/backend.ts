import { SpecialQueue } from "../../../util/data-structures/linked-list";
import type { Logger } from "../../../util/logger";
import { className } from "../../../util/miscellaneous";
import { Scheduler } from "../../../util/schedule";
import { createErrorDefer } from "../../../util/deferred";
import { $EQUALS, $HASHCODE } from "../../../util/values";
import { HashMap } from "../../utils/hash-map";
import type { Version } from "../../utils/versions";
import {
  type FileChangeEvent,
  IncrementalFS,
} from "../file-system/file-system";
import { CacheDB } from "../cache/cache-db";
import {
  type AnyIncrementalComputationDescription,
  IncrementalComputationDescription,
} from "../descriptions/computations";
import {
  functions,
  IncrementalFunctionCallDescription,
} from "../descriptions/functions";
import type {
  IncrementalCellDescription,
  IncrementalCellOwnerDescription,
} from "../descriptions/cells";
import { type IncrementalComputationRuntime, State } from "./computations";
import type { IncrementalCellOwner, IncrementalCellRuntime } from "./cells";
import { IncrementalFileDescription } from "../file-system/file";

export type IncrementalCacheOpts = {
  readonly dir: string;
  readonly garbageCollect: boolean;
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
  readonly logger: Logger;
};

export class IncrementalBackend {
  public static functions = functions;

  private computationsMap: HashMap<
    IncrementalCellOwnerDescription,
    IncrementalComputationRuntime<any, any>
  >;
  readonly computations: readonly [
    SpecialQueue<IncrementalComputationRuntime<any, any>>,
    SpecialQueue<IncrementalComputationRuntime<any, any>>,
    SpecialQueue<IncrementalComputationRuntime<any, any>>,
    SpecialQueue<IncrementalComputationRuntime<any, any>>,
  ];
  private readonly pending: SpecialQueue<
    IncrementalComputationRuntime<any, any>
  >;
  private readonly running: SpecialQueue<
    IncrementalComputationRuntime<any, any>
  >;
  private readonly settledErr: SpecialQueue<
    IncrementalComputationRuntime<any, any>
  >;

  private readonly orphanCellOwners: HashMap<
    IncrementalCellOwnerDescription,
    IncrementalCellOwner
  >;

  private sessionVersion = 0;
  private nextVersion = 0;
  private canInvalidate: boolean;
  private canExternalInvalidate: boolean;

  // Jobs like cleanup tasks that might not fit into the computation lifecycles
  private otherJobs: Promise<unknown>[];
  public readonly fs: IncrementalFS;
  public readonly db: CacheDB | null;
  public readonly logger: Logger;
  private readonly backendLogger: Logger;

  constructor(private readonly opts: IncrementalOpts) {
    this.computationsMap = new HashMap({
      equal: (a, b) => a[$EQUALS](b),
      hash: a => a[$HASHCODE](),
    });
    this.computations = [
      new SpecialQueue(),
      new SpecialQueue(),
      new SpecialQueue(),
      new SpecialQueue(),
    ];
    this.pending = this.computations[State.PENDING];
    this.running = this.computations[State.RUNNING];
    this.settledErr = this.computations[State.SETTLED_ERR];
    this.orphanCellOwners = new HashMap({
      equal: (a, b) => a[$EQUALS](b),
      hash: a => a[$HASHCODE](),
    });
    this.canInvalidate = opts.canInvalidate;
    this.canExternalInvalidate = opts.canInvalidate;
    this.otherJobs = [];
    this.logger = opts.logger;
    this.backendLogger = this.logger.createChildLogger("backend");
    this.fs = new IncrementalFS(opts, this);
    this.db = opts.cache ? new CacheDB(opts.cache, opts.logger) : null;
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

  onComputationError(
    description: AnyIncrementalComputationDescription,
    error: unknown
  ) {
    this.opts.onUncaughtError({
      description,
      error,
    });
  }

  getCellOwner(desc: IncrementalCellOwnerDescription): IncrementalCellOwner {
    if (desc instanceof IncrementalFunctionCallDescription) {
      return this.getComputation(desc, false);
    }
    if (desc instanceof IncrementalFileDescription) {
      return this.fs.getFile(desc.path);
    }
    // TODO support root cells
    throw new Error(`Unknown cell owner type ${className(desc)}`);
  }

  getCell<Desc extends IncrementalCellDescription<any>>(
    desc: Desc
  ): IncrementalCellRuntime<Desc> | undefined {
    return this.getCellOwner(desc.owner0).getCell(desc);
  }

  getComputation<C extends IncrementalComputationRuntime<any, any>>(
    desc: IncrementalComputationDescription<C>,
    root: boolean
  ): C {
    return this.computationsMap.computeIfAbsent(
      desc,
      () => desc.create(this).init(root) satisfies C
    ) as C;
  }

  deleteComputation(c: IncrementalComputationRuntime<any, any>) {
    this.computationsMap.delete(c.desc0);
  }

  markAsOrphan(owner: IncrementalCellOwner) {
    this.orphanCellOwners.set(owner.desc0, owner);
  }

  markAsNeeded(owner: IncrementalCellOwner) {
    this.orphanCellOwners.delete(owner.desc0);
  }

  deleteOrphans() {
    this.backendLogger.debug("Deleting orphans");
    for (const owner of this.orphanCellOwners.values()) {
      if (!owner.isRoot()) {
        owner.delete();
      }
    }
    this.orphanCellOwners.clear();
  }

  getNextVersion(): Version {
    // 0: Distinguish between different sessions
    // 1: Distinguish between different versions in this session
    // (we rely on a global value to ensure that even
    // deleted then recreated cells have different versions)
    return [this.sessionVersion, this.nextVersion++];
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

  // TODO on process.exit, we should loop and see the functions that may be stuck waiting for each other on a kind of deadlock. We know that with promises, the process may just exit if the event loop is empty

  // TODO allow for demand driven executions

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

    // TODO
    // Basic clean up before locking the cache DB (preventing adding/deleting entries)
    /* this.clearOrphans();
    this.db?.lock(); */

    // TODO
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
