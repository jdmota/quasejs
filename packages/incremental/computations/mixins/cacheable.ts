import fsextra from "fs-extra";
import { never } from "../../../util/miscellaneous";
import {
  AnyComputationDescription,
  ResultTypeOfComputation,
  type ComputationDescription,
} from "../../incremental-lib";
import { type ValueDefinition, HashMap, objValue } from "../../utils/hash-map";
import {
  ComputationResult,
  ok,
  VersionedComputationResult,
} from "../../utils/result";
import {
  AnyRawComputation,
  RawComputation,
  RawComputationContext,
  RawComputationExec,
} from "../raw";
import { DependentContext, MaybeDependentComputation } from "./dependent";
import { MaybeParentComputation, MaybeParentContext } from "./parent";
import { CtxWithFS } from "../file-system/file-system";
import { SerializationDB } from "../../../util/serialization";
import { SubscribableComputation } from "./subscribable";
import { ChildComputation } from "./child";

export type CacheableTag = string;

export type CachedGet = {
  readonly kind: "get";
  readonly desc: ComputationDescription<
    RawComputation<any, any> & SubscribableComputation<any>
  >;
  readonly version: number;
};

export type CachedCompute = {
  readonly kind: "compute";
  readonly desc: ComputationDescription<AnyRawComputation & ChildComputation>;
};

export type CachedDep = CachedGet | CachedCompute;

const defaultValDef: ValueDefinition<ComputationDescription<any>> = objValue;

class CacheEntry<Res> {
  constructor(
    readonly value: Res,
    readonly deps: readonly CachedDep[],
    readonly version: number
  ) {}
}

// TODO? https://github.com/parcel-bundler/parcel/blob/v2/packages/core/utils/src/stream.js
// https://github.com/parcel-bundler/parcel/blob/v2/packages/core/cache/src/FSCache.js

export class CacheDB {
  private locked = false;
  private readonly map: HashMap<ComputationDescription<any>, CacheEntry<any>> =
    new HashMap(defaultValDef);

  constructor(
    private readonly dir: string,
    private readonly serializationDB: SerializationDB
  ) {}

  lock() {
    this.locked = true;
  }

  get<C extends AnyRawComputation>(desc: ComputationDescription<C>) {
    return this.map.get(desc) as
      | CacheEntry<ResultTypeOfComputation<C>>
      | undefined;
  }

  set<C extends AnyRawComputation>(
    desc: ComputationDescription<C>,
    entry: CacheEntry<ResultTypeOfComputation<C>> | null
  ) {
    if (this.locked) {
      return;
    }
    if (entry != null) {
      this.map.set(desc, entry);
    }
  }

  delete(desc: ComputationDescription<any>) {
    if (this.locked) {
      return;
    }
    this.map.delete(desc);
  }

  async save() {
    // await fsextra.ensureDir(this.dir);

    // TODO
    console.log("========SAVING CACHE==========");
    for (const [desc, entry] of this.map) {
      console.log("========CACHE==========");
      console.log({
        ...desc,
      });
      console.log(entry);
    }

    // TODO garbage collect old cache entries
  }

  async load() {
    // TODO
    // TODO make versions negative to avoid confusion between versions cached in disk (from a previous session),
    // and versions created at runtime in this session
  }
}

export interface CacheableComputation<
  C extends RawComputation<any, ResultTypeOfComputation<C>>,
> {
  readonly cacheableMixin: CacheableComputationMixin<C>;
}

type CacheableCtx = RawComputationContext &
  CtxWithFS &
  DependentContext &
  MaybeParentContext<any> & {
    readonly request?: any;
  };

export class CacheableComputationMixin<
  C extends RawComputation<any, ResultTypeOfComputation<C>>,
> {
  public readonly db: CacheDB;
  public readonly isCacheable: boolean;
  private firstExec: boolean;

  constructor(
    public readonly source: C &
      MaybeDependentComputation &
      MaybeParentComputation,
    public readonly desc: ComputationDescription<C>
  ) {
    this.db = source.registry.db;
    this.isCacheable = true;
    this.firstExec = true;
  }

  finishRoutine({
    result,
    version,
  }: VersionedComputationResult<
    ResultTypeOfComputation<C>
  >): VersionedComputationResult<ResultTypeOfComputation<C>> {
    if (this.isCacheable) {
      const { firstExec } = this;
      this.firstExec = false;

      if (result.ok) {
        const calls: CachedDep[] = [];

        if (this.source.dependentMixin) {
          const getCalls = this.source.dependentMixin.getAllGetCalls();
          if (!getCalls) {
            this.db.delete(this.desc);
            return { result, version };
          }
          for (const dep of getCalls) {
            calls.push({
              kind: "get",
              desc: dep.computation.description,
              version: dep.version,
            });
          }
        }

        if (this.source.parentMixin) {
          for (const child of this.source.parentMixin.getChildren()) {
            calls.push({
              kind: "compute",
              desc: child.description,
            });
          }
        }

        let newEntry = new CacheEntry(result.value, calls, version);

        if (firstExec) {
          const currentEntry = this.db.get(this.desc);
          if (currentEntry) {
            const cached = currentEntry.value;
            if (
              cached === result.value ||
              this.source.responseEqual(cached, result.value)
            ) {
              // If the final value is the same, keep the cached version number
              newEntry = new CacheEntry(cached, calls, currentEntry.version);
            }
          }
        }

        this.db.set(this.desc, newEntry);
        return {
          result: ok(newEntry.value),
          version: newEntry.version,
        };
      } else {
        this.db.delete(this.desc);
      }
    }
    return { result, version };
  }

  invalidateRoutine() {
    if (this.isCacheable) {
      this.firstExec = false;
      this.db.delete(this.desc);
    }
  }

  deleteRoutine() {
    if (this.isCacheable) {
      this.firstExec = false;
      this.db.delete(this.desc);
    }
  }

  // If a computation only relies on "ctx" calls, then we can use this
  // Otherwise, do not use this, instead, just rely on the "finishRoutine"
  // to give subscribers the correct version by using "responseEqual"
  async exec<Ctx extends CacheableCtx>(
    baseExec: RawComputationExec<Ctx, ResultTypeOfComputation<C>>,
    ctx: Ctx,
    runId: number
  ): Promise<ComputationResult<ResultTypeOfComputation<C>>> {
    if (this.isCacheable && this.firstExec) {
      const currentEntry = this.db.get(this.desc);
      if (currentEntry) {
        const cached = currentEntry.value;
        try {
          const jobs = [];
          for (const dep of currentEntry.deps) {
            switch (dep.kind) {
              case "get": {
                if (this.source.dependentMixin) {
                  jobs.push(
                    this.source.dependentMixin
                      .getDep(dep.desc, runId)
                      .then(({ result, version }) => {
                        if (!result.ok || version !== dep.version) {
                          throw new Error("Outdated");
                        }
                      })
                  );
                } else {
                  throw new Error("Outdated");
                }
                break;
              }
              case "compute":
                if (this.source.parentMixin) {
                  this.source.parentMixin.compute(
                    this.source.registry.make(dep.desc),
                    runId
                  );
                } else {
                  throw new Error("Outdated");
                }
                break;
              default:
                never(dep);
            }
          }
          await Promise.all(jobs);
          return ok(cached);
        } catch (err) {
          // Check we are still running
          ctx.checkActive();
          // Invalidate
          this.source.dependentMixin?.invalidateRoutine();
          this.source.parentMixin?.invalidateRoutine();
          this.invalidateRoutine();
        }
      }
    }

    // Execute
    return baseExec(ctx);
  }
}
