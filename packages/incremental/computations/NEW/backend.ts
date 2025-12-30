import { SpecialQueue } from "../../../util/data-structures/linked-list";
import type { Logger } from "../../../util/logger";
import { HashMap } from "../../utils/hash-map";
import type { Version } from "../../utils/versions";
import {
  type CellValueDescriptions,
  IncrementalFunctionCallDescription,
  functions,
} from "./functions";
import { IncrementalFunctionRuntime, State } from "./function-runtime";
import { Scheduler } from "../../../util/schedule";
import { createErrorDefer } from "../../../util/deferred";

export type IncrementalCacheOpts = {
  readonly dir: string;
  readonly garbageCollect: boolean;
  readonly logger: Logger;
};

export type IncrementalOpts = {
  // readonly entry: ComputationDescription<C>;
  readonly onUncaughtError: (
    info: Readonly<{
      description: IncrementalFunctionCallDescription<any, any, any> | null;
      error: unknown;
    }>
  ) => void;
  /* readonly fs: {
    readonly onEvent: (event: FileChangeEvent) => void;
  }; */
  readonly cache: IncrementalCacheOpts | false;
  readonly canInvalidate: boolean;
};

export class IncrementalBackend {
  public static functions = functions;

  private map: HashMap<
    IncrementalFunctionCallDescription<any, any, any>,
    IncrementalFunctionRuntime<any, any, any>
  >;
  readonly computations: readonly [
    SpecialQueue<IncrementalFunctionRuntime<any, any, any>>,
    SpecialQueue<IncrementalFunctionRuntime<any, any, any>>,
    SpecialQueue<IncrementalFunctionRuntime<any, any, any>>,
    SpecialQueue<IncrementalFunctionRuntime<any, any, any>>,
  ];
  private sessionVersion = 0;
  private nextVersion = 0;
  private canInvalidate: boolean;
  private canExternalInvalidate: boolean;
  private readonly pending: SpecialQueue<
    IncrementalFunctionRuntime<any, any, any>
  >;
  private readonly running: SpecialQueue<
    IncrementalFunctionRuntime<any, any, any>
  >;
  private readonly settledErr: SpecialQueue<
    IncrementalFunctionRuntime<any, any, any>
  >;
  // Jobs like cleanup tasks that might not fit into the computation lifecycles
  private otherJobs: Promise<unknown>[];

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
  }

  queueOtherJob(
    desc: IncrementalFunctionCallDescription<any, any, any> | null,
    fn: () => Promise<unknown>
  ) {
    this.otherJobs.push(
      Promise.resolve()
        .then(fn)
        .catch(err => this.emitUncaughtError(desc, err))
    );
  }

  private emitUncaughtError(
    desc: IncrementalFunctionCallDescription<any, any, any> | null,
    error: unknown
  ) {
    this.opts.onUncaughtError({ description: desc, error });
  }

  get<Input, Output, CellDefs extends CellValueDescriptions>(
    desc: IncrementalFunctionCallDescription<Input, Output, CellDefs>
  ): IncrementalFunctionRuntime<Input, Output, CellDefs> | undefined {
    functions.check(desc.schema);
    return this.map.get(desc);
  }

  make<Input, Output, CellDefs extends CellValueDescriptions>(
    desc: IncrementalFunctionCallDescription<Input, Output, CellDefs>
  ): IncrementalFunctionRuntime<Input, Output, CellDefs> {
    functions.check(desc.schema);
    return this.map.computeIfAbsent(
      desc,
      () => new IncrementalFunctionRuntime(this, desc)
    );
  }

  delete(c: IncrementalFunctionRuntime<any, any, any>) {
    this.map.delete(c.desc);
  }

  getNextVersion(): Version {
    // 0: Distinguish between different sessions
    // 1: Distinguish between different versions in this session
    // (we rely on a global value to ensure that even
    // deleted then recreated computations have different versions)
    return [this.sessionVersion, this.nextVersion++];
  }

  onFunctionError(
    desc: IncrementalFunctionCallDescription<any, any, any>,
    err: any
  ) {
    // TODO
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
  externalInvalidate(computation: IncrementalFunctionRuntime<any, any, any>) {
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

  run<Input, Output, CellDefs extends CellValueDescriptions>(
    computation: IncrementalFunctionRuntime<Input, Output, CellDefs>
  ): Promise<void> {
    return Promise.race([computation.run(), this.interruptedDefer.promise]);
  }

  private interruptedDefer = createErrorDefer();
  private cleaningUp = false;

  isCleaningUp() {
    return this.cleaningUp;
  }
}
