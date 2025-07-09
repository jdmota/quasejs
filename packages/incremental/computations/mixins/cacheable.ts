import { never } from "../../../util/miscellaneous";
import { type ComputationDescription } from "../../incremental-lib";
import { type ValueDefinition, HashMap, objValue } from "../../utils/hash-map";
import { ComputationResult, ok, promiseIfOk } from "../../utils/result";
import {
  BasicComputationContext,
  BasicComputationDescription,
  BasicComputationExec,
} from "../basic";
import { SubscribableComputation } from "../mixins/subscribable";
import { RawComputation } from "../raw";
import { DependentComputation, DependentContext } from "./dependent";
import { ParentContext } from "./parent";

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
  readonly tag: CacheableTag;
  readonly serializer: Serializable<Desc>;
};

type CachedCompute<ComputeReq> = {
  readonly kind: "compute";
  readonly req: ComputeReq;
  readonly serializer: Serializable<ComputeReq>;
};

export type CachedDep = CachedGet<any> | CachedCompute<any>;

type SubscribableDescription<T> = ComputationDescription<
  RawComputation<any, T> & SubscribableComputation<T>
>;

const defaultValDef1: ValueDefinition<BasicComputationDescription<any, any>> =
  objValue;

class CacheEntryBuilder {
  // We don't know if by any chance we requested the same dependency twice
  // and got different values (because subscribers invalidation is delayed - see SubscribableComputationMixin),
  // so we keep an array instead of a map
  private readonly deps: CachedDep[] = [];

  // Track the number of times getDependency() was called
  private requested = 0;

  // Prevent modifications of the dependencies array that could happen after user code executed
  // but while ctx.checkActive() is still true
  // (in the case the user forgot to await upon "ctx.get()")
  private locked = false;

  checkActive() {
    if (this.locked) {
      throw new Error("Computation not active");
    }
  }

  async get<T>(
    ctx: DependentContext,
    desc: SubscribableDescription<T>,
    serializer: Serializable<T> | null | undefined
  ) {
    this.checkActive();
    this.requested++;
    const result = await ctx.get(desc);
    if (result.ok) {
      this.checkActive();
      if (serializer && desc.serializer) {
        this.deps.push({
          kind: "get",
          desc,
          tag: serializer.getTag(result.value),
          serializer: desc.serializer.descSerializer,
        } satisfies CachedGet<typeof desc>);
      } else {
        // TODO warn about missing serializer
      }
    }
    return result;
  }

  compute<ComputeReq>(
    ctx: ParentContext<ComputeReq>,
    req: ComputeReq,
    serializer: Serializable<ComputeReq> | null | undefined
  ) {
    this.checkActive();
    this.requested++;
    ctx.compute(req);
    if (serializer) {
      this.deps.push({
        kind: "compute",
        req,
        serializer,
      } satisfies CachedCompute<ComputeReq>);
    } else {
      // TODO warn about missing serializer
    }
  }

  make<Res>(value: Res): CacheEntry<Res> | null {
    if (this.requested !== this.deps.length) {
      // There is no point in storing a cache entry if we could not save some of its dependencies
      return null;
    }
    this.locked = true;
    return new CacheEntry(value, this.deps);
  }
}

class CacheEntry<Res> {
  constructor(
    readonly value: Res,
    readonly deps: readonly CachedDep[]
  ) {}

  getValue() {
    return this.value;
  }

  getDeps() {
    return this.deps;
  }
}

export class CacheDB {
  private readonly map: HashMap<
    BasicComputationDescription<any, any>,
    CacheEntry<any>
  > = new HashMap(defaultValDef1);

  get<Req, Res>(desc: BasicComputationDescription<Req, Res>) {
    return this.map.get(desc) as CacheEntry<Res> | undefined;
  }

  set<Req, Res>(
    desc: BasicComputationDescription<Req, Res>,
    entry: CacheEntry<Res> | null
  ) {
    if (entry != null) {
      this.map.set(desc, entry);
    }
  }

  delete<Req, Res>(desc: BasicComputationDescription<Req, Res>) {
    this.map.delete(desc);
  }

  async save() {
    // TODO
  }

  async load() {
    // TODO
  }
}

export interface CacheableComputation<Req, Res> {
  readonly cacheableMixin: CacheableComputationMixin<Req, Res>;
}

// TODO use this also in jobs of pool
export class CacheableComputationMixin<Req, Res> {
  public readonly db: CacheDB;
  public readonly isCacheable: boolean;
  private firstExec: boolean;

  constructor(
    public readonly source: RawComputation<any, Res> & DependentComputation,
    public readonly desc: BasicComputationDescription<Req, Res>
  ) {
    this.db = source.registry.db;
    this.isCacheable = !!desc.serializer;
    this.firstExec = true;
  }

  async exec(
    baseExec: BasicComputationExec<Req, Res>,
    ctx: BasicComputationContext<Req>
  ): Promise<ComputationResult<Res>> {
    if (!this.isCacheable) {
      return baseExec(ctx);
    }

    if (this.firstExec) {
      this.firstExec = false;
      const currentEntry = this.db.get(this.desc);
      if (currentEntry) {
        const cached = currentEntry.getValue();
        try {
          const jobs = [];
          for (const dep of currentEntry.getDeps()) {
            const { serializer } = dep.desc;
            if (serializer == null) throw new Error("No serializer");
            switch (dep.kind) {
              case "dep": {
                jobs.push(
                  ctx.get(dep.desc).then(result => {
                    if (
                      !result.ok ||
                      serializer.valueSerializer.getTag(result.value) !==
                        dep.tag
                    ) {
                      throw new Error("Outdated");
                    }
                  })
                );
                break;
              }
              case "child":
                // TODO
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
          // Reset dependencies and cache
          this.source.dependentMixin.invalidateRoutine();
          this.db.delete(this.desc);
        }
      }
    }

    // New entry
    const newEntry = new CacheEntryBuilder(ctx);
    // Execute
    const result = await baseExec({
      request: ctx.request,
      checkActive: () => newEntry.checkActive(),
      get: desc => newEntry.get(desc, desc.serializer?.valueSerializer),
      getOk: desc =>
        promiseIfOk(newEntry.get(desc, desc.serializer?.valueSerializer)),
      fs: ctx.fs,
    });
    // On success, save result
    if (result.ok) {
      ctx.checkActive();
      this.db.set(this.desc, newEntry.make(result.value));
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
