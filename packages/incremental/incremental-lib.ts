// Computations are functions
// They accept (immutable) arguments and produce results
// The arguments and results may be serialized and deserialized
// They may also be associated with equality functions to avoid unnecessary recomputations
// The computations also have an implementation version so that results cached in disk can be invalidated if the plugin gets a new version
// Since computations may be asynchronous, to ensure determinism, they may only depend on other computations and on the (immutable) arguments
// Circular dependencies are detected at runtime

import { createDefer } from "./utils/deferred";
import { HashMap } from "./utils/hash-map";
import { SpecialQueue } from "./utils/linked-list";
import { AnyRawComputation, State } from "./computations/raw";
import { Result } from "./utils/result";
import { Scheduler } from "./utils/schedule";
import {
  SimpleEffectComputationExec,
  newSimpleEffectComputation,
} from "./computations/simple-effect";
import { EffectComputation } from "./computations/effect";

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

export type ComputationDescription<C extends AnyRawComputation> = {
  readonly create: (registry: ComputationRegistry) => C;
  readonly equal: <O extends AnyRawComputation>(
    other: ComputationDescription<O>
  ) => boolean;
  readonly hash: () => number;
};

type ComputationRegistryOpts = {
  readonly canInvalidate: boolean;
};

export class ComputationRegistry {
  private readonly canInvalidate: boolean;
  private canExternalInvalidate: boolean;
  private map: HashMap<ComputationDescription<any>, AnyRawComputation>;
  readonly computations: readonly [
    SpecialQueue<AnyRawComputation>,
    SpecialQueue<AnyRawComputation>,
    SpecialQueue<AnyRawComputation>,
    SpecialQueue<AnyRawComputation>
  ];
  private readonly pending: SpecialQueue<AnyRawComputation>;
  private readonly running: SpecialQueue<AnyRawComputation>;
  private readonly settledUnstable: SpecialQueue<AnyRawComputation>;

  private constructor(opts: ComputationRegistryOpts) {
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

  // External invalidations, like those caused by file changes,
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

  // TODO To avoid circular dependencies, we can force each computation to state the types of computations it will depend on. This will force the computation classes to be defined before the ones that will depend on it.
  // TODO delete unneeed computations during execution?
  // TODO peek errors and return a list of them? create a error pool and report only those?
  /*
    for (const c of this.errored.iterateAll()) {
      errors.push(c.peekError());
    }
  */

  private cleanupRun(computation: EffectComputation<undefined, any>) {
    computation.unroot();
    computation.destroy();
    let count;
    do {
      count = this.computationsCount();
      for (const c of Array.from(this.map.values())) {
        c.maybeDestroy();
      }
    } while (this.computationsCount() < count);

    if (this.computationsCount() > 0) {
      throw new Error("Invariant violation: Cleanup failed");
    }
  }

  static async singleRun<T>(
    exec: SimpleEffectComputationExec<T>
  ): Promise<Result<T>> {
    const registry = new ComputationRegistry({ canInvalidate: false });
    const desc = newSimpleEffectComputation({ exec });
    const computation = registry.make(desc);
    const result = await computation.run();
    registry.cleanupRun(computation);
    return result;
  }

  static run<T>(
    exec: SimpleEffectComputationExec<T>
  ): ComputationController<T> {
    const defer = createDefer<Result<T>>();
    const registry = new ComputationRegistry({ canInvalidate: true });
    const desc = newSimpleEffectComputation({ exec });
    const computation = registry.make(desc);
    registry.wake();

    return {
      promise: defer.promise,
      interrupt() {
        registry.cleanupRun(computation);
        defer.reject(new Error("Interrupted"));
      },
      finish() {
        if (registry.externalInvalidationsAllowed()) {
          registry.disableExternalInvalidations();
          registry.invalidateSettledUnstable();
          registry
            .wait()
            .then(async () => {
              const result = await computation.run();
              registry.cleanupRun(computation);
              return result;
            })
            .then(defer.resolve, defer.reject);
        }
      },
    };
  }
}

type ComputationController<T> = {
  readonly promise: Promise<Result<T>>;
  readonly interrupt: () => void;
  readonly finish: () => void;
};
