import { SpecialQueue2 } from "../../util/data-structures/linked-list";
import type { Logger } from "../../util/logger";
import { assertion, className } from "../../util/miscellaneous";
import { Scheduler } from "../../util/schedule";
import { createDefer } from "../../util/deferred";
import { $EQUALS, $FORMAT, $HASHCODE } from "../../util/values";
import { HashMap } from "../utils/hash-map";
import type { Version } from "../utils/versions";
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
  type CellsTypes,
} from "../descriptions/functions";
import type {
  IncrementalCellDescription,
  IncrementalCellOwnerDescription,
} from "../descriptions/cells";
import {
  type IncrementalComputationRuntime,
  NEXT_COMPUTATION,
  PREV_COMPUTATION,
  State,
} from "./computations";
import {
  type IncrementalCellOwner,
  NEXT_CELL_OWNER,
  PREV_CELL_OWNER,
} from "./cell-owners";
import { type IncrementalCellRuntime } from "./cells";
import { IncrementalFileDescription } from "../file-system/file";
import { IncrementalRoot, IncrementalRootDescription } from "./root";

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

export class IncrementalBackend<RootCells extends CellsTypes> {
  public static functions = functions;

  private computationsMap: HashMap<
    IncrementalCellOwnerDescription,
    IncrementalComputationRuntime<any, any>
  >;
  readonly computations: readonly [
    SpecialQueue2<IncrementalComputationRuntime<any, any>>,
    SpecialQueue2<IncrementalComputationRuntime<any, any>>,
    SpecialQueue2<IncrementalComputationRuntime<any, any>>,
    SpecialQueue2<IncrementalComputationRuntime<any, any>>,
    SpecialQueue2<IncrementalComputationRuntime<any, any>>,
  ];
  private readonly pending: SpecialQueue2<
    IncrementalComputationRuntime<any, any>
  >;
  private readonly running: SpecialQueue2<
    IncrementalComputationRuntime<any, any>
  >;
  private readonly settledErr: SpecialQueue2<
    IncrementalComputationRuntime<any, any>
  >;

  private readonly orphanCellOwners: SpecialQueue2<IncrementalCellOwner>;

  public readonly rootCellOwner: IncrementalRoot<RootCells>;

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
      new SpecialQueue2(PREV_COMPUTATION, NEXT_COMPUTATION),
      new SpecialQueue2(PREV_COMPUTATION, NEXT_COMPUTATION),
      new SpecialQueue2(PREV_COMPUTATION, NEXT_COMPUTATION),
      new SpecialQueue2(PREV_COMPUTATION, NEXT_COMPUTATION),
      new SpecialQueue2(PREV_COMPUTATION, NEXT_COMPUTATION),
    ];
    this.pending = this.computations[State.PENDING];
    this.running = this.computations[State.RUNNING];
    this.settledErr = this.computations[State.SETTLED_ERR];
    this.orphanCellOwners = new SpecialQueue2(PREV_CELL_OWNER, NEXT_CELL_OWNER);
    this.canInvalidate = opts.canInvalidate;
    this.canExternalInvalidate = opts.canInvalidate;
    this.otherJobs = [];
    this.logger = opts.logger;
    this.backendLogger = this.logger.createChildLogger("backend");
    this.fs = new IncrementalFS(opts, this);
    this.db = opts.cache ? new CacheDB(opts.cache, opts.logger) : null;
    this.rootCellOwner = new IncrementalRoot(this);
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
    if (desc instanceof IncrementalRootDescription) {
      return this.rootCellOwner;
    }
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
      () => desc.create(this).markRoot(root) satisfies C
    ) as C;
  }

  deleteComputation(c: IncrementalComputationRuntime<any, any>) {
    this.computationsMap.delete(c.desc0);
  }

  markNeed(owner: IncrementalCellOwner, needed: boolean, init = false) {
    if (init) {
      if (!needed) {
        this.orphanCellOwners.add(owner);
      }
    } else {
      this.backendLogger.debug(
        `Changing need of ${owner.desc0[$FORMAT]()} to ${needed}`
      );
      if (needed) {
        this.orphanCellOwners.delete(owner);
      } else {
        this.orphanCellOwners.add(owner);
      }
    }
  }

  deleteOrphans() {
    this.backendLogger.debug(`Deleting orphans...`);
    let deleted = 0;
    for (const owner of this.orphanCellOwners.keepTaking()) {
      owner.inv();
      assertion(!owner.isNeeded());
      owner.delete();
      this.orphanCellOwners.delete(owner);
      deleted++;
    }
    this.backendLogger.debug(`Deleted ${deleted} orphans`);
  }

  getNextVersion(): Version {
    // 0: Distinguish between different sessions
    // 1: Distinguish between different versions in this session
    // (we rely on a global value to ensure that even
    // deleted then recreated cells have different versions)
    return [this.sessionVersion, this.nextVersion++];
  }

  private loaded = false;

  async load() {
    if (this.db && !this.loaded) {
      this.sessionVersion = await this.db.newGlobalSession();
      this.loaded = true;
    }
  }

  // TODO demand driven
  // TODO when to gc?
  // TODO re-implement safe closing routine
  // TODO careful: closing or evicting should not delete from the cache
  // TODO on process.exit, we should loop and see the functions that may be stuck waiting for each other on a kind of deadlock. We know that with promises, the process may just exit if the event loop is empty

  invalidationsAllowed() {
    return this.canInvalidate;
  }

  disableInvalidations() {
    this.canInvalidate = false;
  }

  externalInvalidationsAllowed() {
    return this.canExternalInvalidate;
  }

  disableExternalInvalidations() {
    this.canExternalInvalidate = false;
  }

  private invalidateSettledErr() {
    for (const c of this.settledErr.keepTaking()) {
      c.invalidate();
    }
  }

  private scheduler1 = new Scheduler(() => this.wake(), 100);
  private scheduler2 = new Scheduler(() => {
    this.invalidateSettledErr();
    this.wake();
  }, 200);

  scheduleWake() {
    if (this.canInvalidate) {
      this.scheduler1.schedule();
    }
  }

  private wake() {
    this.scheduler1.cancel();
    let computation;
    while ((computation = this.pending.peek())) {
      assertion(computation.isNeeded());
      computation.run();
    }
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

  async wait() {
    this.backendLogger.debug("Waiting...");
    while (!this.pending.isEmpty() || !this.running.isEmpty()) {
      this.wake();
      const computation = this.running.peek();
      if (computation) {
        await this.run(computation);
      }
    }
    this.backendLogger.debug("Wait done");
  }

  run<Ctx, Output>(
    computation: IncrementalComputationRuntime<Ctx, Output>
  ): Promise<void> {
    return Promise.race([computation.run(), this.interruptedDefer.promise]);
  }

  peekErrors() {
    // this.deleteOrphans();
    const errors: unknown[] = [];
    // TODO
    /* for (const c of this.computations[State.SETTLED_ERR].iterateAll()) {
      const res = c.peekResult();
      if (!res.ok) {
        errors.push(res.error);
      }
    } */
    return errors;
  }

  private interruptedDefer = createDefer<void>();
  private cleaningUp = false;

  isCleaningUp() {
    return this.cleaningUp;
  }

  cleanupRun(interrupted: boolean) {
    if (this.cleaningUp) return;
    this.cleaningUp = true;
    this.interruptedDefer.resolve();

    this.scheduler1.cancel();
    this.scheduler2.cancel();

    // Basic clean up before locking the cache DB (preventing adding/deleting entries)
    this.deleteOrphans();
    this.db?.lock();

    // TODO evict everything, ensure it is cached

    /* if (this.computationsCount() > 0) {
      throw new Error("Invariant violation: Cleanup failed");
    } */

    const { db, fs } = this;
    this.queueOtherJob(null, () => fs.close());
    if (db) this.queueOtherJob(null, () => db.save(interrupted));

    const { otherJobs } = this;
    this.otherJobs = [];
    return Promise.all(otherJobs);
  }
}
