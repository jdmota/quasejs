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
} from "../../utils/result";
import { BasicComputationContext } from "../basic";
import { SubscribableComputation } from "../mixins/subscribable";
import { AnyRawComputation, RawComputation, RawComputationExec } from "../raw";
import { DependentComputation, DependentContext } from "./dependent";
import {
  MaybeParentComputation,
  MaybeParentContext,
  ParentContext,
} from "./parent";

export interface Serializable<T> {
  getTag(value: T): CacheableTag;
  serialize(result: T): Buffer;
  deserialize(result: Buffer): T;
}

export type SerializableSettings<Desc, Val> =
  | {
      readonly descSerializer: Serializable<Desc>;
      readonly valueSerializer: Serializable<Val>;
    }
  | null
  | undefined;

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

const defaultValDef1: ValueDefinition<ComputationDescription<any>> = objValue;

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

export class CacheDB {
  private readonly map: HashMap<ComputationDescription<any>, CacheEntry<any>> =
    new HashMap(defaultValDef1);

  get<C extends AnyRawComputation>(desc: ComputationDescription<C>) {
    return this.map.get(desc) as
      | CacheEntry<ResultTypeOfComputation<C>>
      | undefined;
  }

  set<C extends AnyRawComputation>(
    desc: ComputationDescription<C>,
    entry: CacheEntry<ResultTypeOfComputation<C>> | null
  ) {
    if (entry != null) {
      this.map.set(desc, entry);
    }
  }

  delete(desc: ComputationDescription<any>) {
    this.map.delete(desc);
  }

  async save() {
    // TODO
  }

  async load() {
    // TODO
    // TODO make versions negative to avoid confusion between versions cached in disk (from a previous session),
    // and versions created at runtime in this session
  }
}

export interface CacheableComputation<C extends AnyRawComputation> {
  readonly cacheableMixin: CacheableComputationMixin<C>;
}

type CacheableCtx = BasicComputationContext<any> & MaybeParentContext<any>;

// TODO use this also in jobs of pool
export class CacheableComputationMixin<C extends AnyRawComputation> {
  public readonly db: CacheDB;
  public readonly isCacheable: boolean;
  private firstExec: boolean;

  constructor(
    public readonly source: C & DependentComputation & MaybeParentComputation,
    public readonly desc: ComputationDescription<C>
  ) {
    this.db = source.registry.db;
    this.isCacheable = !!desc.serializer;
    this.firstExec = true;
  }

  async exec(
    baseExec: RawComputationExec<CacheableCtx, ResultTypeOfComputation<C>>,
    ctx: CacheableCtx
  ): Promise<ComputationResult<ResultTypeOfComputation<C>>> {
    if (!this.isCacheable) {
      return baseExec(ctx);
    }

    if (this.firstExec) {
      this.firstExec = false;
      const currentEntry = this.db.get(this.desc);
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
          throw new CachedResult(ok(cached), currentEntry.version);
        } catch (err) {
          // Check we are still running
          ctx.checkActive();
          // Reset dependencies and cache
          this.source.dependentMixin.invalidateRoutine();
          this.source.parentMixin?.invalidateRoutine();
          this.db.delete(this.desc);
        }
      }
    }

    // New entry
    const newEntry = new CacheEntryBuilder();
    // Execute
    const result = await baseExec({
      version: ctx.version,
      request: ctx.request,
      checkActive: () => {
        ctx.checkActive();
        newEntry.checkActive();
      },
      get: desc => newEntry.get(ctx, desc).then(r => r.result),
      getOk: desc => promiseIfOk(newEntry.get(ctx, desc).then(r => r.result)),
      getVersioned: desc => newEntry.get(ctx, desc),
      fs: ctx.fs,
      compute: ctx.compute
        ? req => newEntry.compute(ctx as ParentContext<any>, req)
        : undefined,
    });
    // On success, save result
    if (result.ok) {
      ctx.checkActive();
      this.db.set(this.desc, newEntry.make(result.value, ctx.version));
    }
    return result;
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
}
