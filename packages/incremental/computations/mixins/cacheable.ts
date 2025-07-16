import fsextra from "fs-extra";
import { never } from "../../../util/miscellaneous";
import {
  ResultTypeOfComputation,
  type ComputationDescription,
} from "../../incremental-lib";
import { type ValueDefinition, HashMap, objValue } from "../../utils/hash-map";
import {
  CachedResult,
  ComputationResult,
  ok,
  promiseIfOk,
  VersionedComputationResult,
} from "../../utils/result";
import { SubscribableComputation } from "../mixins/subscribable";
import {
  AnyRawComputation,
  RawComputation,
  RawComputationContext,
  RawComputationExec,
} from "../raw";
import { DependentContext, MaybeDependentComputation } from "./dependent";
import {
  MaybeParentComputation,
  MaybeParentContext,
  ParentContext,
} from "./parent";
import { CtxWithFS } from "../file-system/file-system";
import { SerializationDB } from "../../../util/serialization";

export type CacheableTag = string;

type CachedGet<Desc extends SubscribableDescription<any>> = {
  readonly kind: "get";
  readonly desc: Desc;
  readonly version: number;
};

type CachedCompute<ComputeReq> = {
  readonly kind: "compute";
  readonly req: ComputeReq;
};

export type CachedDep = CachedGet<any> | CachedCompute<any>;

type SubscribableDescription<T> = ComputationDescription<
  RawComputation<any, T> & SubscribableComputation<T>
>;

const defaultValDef: ValueDefinition<ComputationDescription<any>> = objValue;

class CacheEntryBuilder {
  // We don't know if by any chance we requested the same dependency twice
  // and got different values (because subscribers invalidation is delayed - see SubscribableComputationMixin),
  // so we keep an array instead of a map
  private readonly deps: CachedDep[] = [];

  // Track the number of times ctx functions were called
  private requested = 0;

  // Prevent modifications of the dependencies array that could happen after user code executed
  // but while ctx.checkActive() is still true
  // (e.g., in the case the user forgot to await upon "ctx.get()")
  private locked = false;

  checkActive() {
    if (this.locked) {
      throw new Error("Computation not active");
    }
  }

  async get<T>(ctx: DependentContext, desc: SubscribableDescription<T>) {
    this.checkActive();
    this.requested++;
    const result = await ctx.getVersioned(desc);
    if (result.result.ok) {
      this.checkActive();
      this.deps.push({
        kind: "get",
        desc,
        version: result.version,
      } satisfies CachedGet<typeof desc>);
    }
    return result;
  }

  compute<ComputeReq>(ctx: ParentContext<ComputeReq>, req: ComputeReq) {
    this.checkActive();
    this.requested++;
    ctx.compute(req);
    this.deps.push({
      kind: "compute",
      req,
    } satisfies CachedCompute<ComputeReq>);
  }

  make<Res>(value: Res, version: number): CacheEntry<Res> | null {
    if (this.requested !== this.deps.length) {
      // There is no point in storing a cache entry if we could not save some of its dependencies
      return null;
    }
    this.locked = true;
    return new CacheEntry(value, this.deps, version);
  }
}

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
    await fsextra.ensureDir(this.dir);

    // TODO
    console.log("========SAVING CACHE==========");
    for (const [desc, entry] of this.map) {
      console.log("========CACHE==========");
      console.log({
        ...desc,
        source: null,
      });
      console.log(entry);
    }
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
  private entry: CacheEntryBuilder;

  constructor(
    public readonly source: C &
      MaybeDependentComputation &
      MaybeParentComputation,
    public readonly desc: ComputationDescription<C>
  ) {
    this.db = source.registry.db;
    this.isCacheable = true;
    this.firstExec = true;
    this.entry = new CacheEntryBuilder();
  }

  finishRoutine({
    result,
    version,
  }: VersionedComputationResult<ResultTypeOfComputation<C>>): void {
    if (this.isCacheable) {
      if (result.ok) {
        this.db.set(this.desc, this.entry.make(result.value, version));
      }
    }
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

  async reExec(
    baseExec: (
      ctx: RawComputationContext
    ) => Promise<ComputationResult<ResultTypeOfComputation<C>>>,
    ctx: RawComputationContext
  ) {
    if (!this.isCacheable) {
      return baseExec(ctx);
    }
    const { firstExec } = this;
    this.firstExec = false;
    this.entry = new CacheEntryBuilder();

    // Execute
    const result = await baseExec(ctx);

    // Check we are still running
    ctx.checkActive();

    if (firstExec) {
      const currentEntry = this.db.get(this.desc);
      if (currentEntry) {
        const cached = currentEntry.value;
        if (result.ok && this.source.responseEqual(cached, result.value)) {
          throw new CachedResult(ok(cached), currentEntry.version); // See RawComputation#run()
        }
        // Reset cache
        this.db.delete(this.desc);
      }
    }

    return result;
  }

  async exec<Ctx extends CacheableCtx>(
    baseExec: RawComputationExec<Ctx, ResultTypeOfComputation<C>>,
    ctx: Ctx
  ): Promise<ComputationResult<ResultTypeOfComputation<C>>> {
    if (!this.isCacheable) {
      return baseExec(ctx);
    }

    const { firstExec } = this;
    this.firstExec = false;

    const newEntry = (this.entry = new CacheEntryBuilder());

    let cachedResult;
    let currentEntry;

    if (firstExec) {
      currentEntry = this.db.get(this.desc);
      if (currentEntry) {
        const cached = currentEntry.value;
        try {
          const jobs = [];
          for (const dep of currentEntry.deps) {
            switch (dep.kind) {
              case "get": {
                jobs.push(
                  ctx.getVersioned(dep.desc).then(result => {
                    if (!result.result.ok || result.version !== dep.version) {
                      throw new Error("Outdated");
                    }
                  })
                );
                break;
              }
              case "compute":
                if (ctx.compute) {
                  ctx.compute(dep.req);
                } else {
                  throw new Error("Outdated");
                }
                break;
              default:
                never(dep);
            }
          }
          await Promise.all(jobs);
          cachedResult = new CachedResult(ok(cached), currentEntry.version);
        } catch (err) {
          // Check we are still running
          ctx.checkActive();
          // Reset dependencies and cache
          this.source.dependentMixin?.invalidateRoutine();
          this.source.parentMixin?.invalidateRoutine();
          this.db.delete(this.desc);
        }
        if (cachedResult) {
          throw cachedResult; // See RawComputation#run()
        }
      }
    }

    // Create new context
    const newCtx: CacheableCtx = {
      request: ctx.request,
      checkActive: () => {
        ctx.checkActive();
        newEntry.checkActive();
      },
      get: desc => newEntry.get(ctx, desc).then(r => r.result),
      getOk: desc => promiseIfOk(newEntry.get(ctx, desc).then(r => r.result)),
      getVersioned: desc => newEntry.get(ctx, desc),
      fs: (a, b, c) => this.source.registry.fs.depend(newCtx, a, b, c),
      compute: ctx.compute
        ? req => newEntry.compute(ctx as ParentContext<any>, req)
        : undefined,
    };
    // Execute
    const result = await baseExec(newCtx as any);
    // Even if dependencies changes, who knows if the value is the same
    // To avoid re-execution of subscribers,
    // it is useful to return the cached value with its version
    if (result.ok && firstExec && currentEntry) {
      const cached = currentEntry.value;
      if (this.source.responseEqual(cached, result.value)) {
        throw new CachedResult(ok(cached), currentEntry.version); // See RawComputation#run()
      }
    }
    return result;
  }
}
