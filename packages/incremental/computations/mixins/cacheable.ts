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
import { DependentComputation } from "./dependent";

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

type AnySubscribableDescription = ComputationDescription<
  RawComputation<any, any> & SubscribableComputation<any>
>;

const defaultValDef1: ValueDefinition<BasicComputationDescription<any, any>> =
  objValue;

class CacheEntryBuilder<Res> {
  // We don't know if by any chance we requested the same dependency twice
  // and got different values (because subscribers invalidation is delayed - see SubscribableComputationMixin),
  // so we keep an array instead of a map
  private readonly deps: [AnySubscribableDescription, CacheableTag][] = [];

  // Track the number of times getDependency() was called
  private requested = 0;

  // Prevent modifications of the dependencies array that could happen after user code executed
  // but while checkActive() is still true
  // (in the case the user forgot to await upon "ctx.get()")
  private locked = false;

  async getDependency<T>(
    ctx: {
      readonly checkActive: () => void;
      readonly get: <T>(
        desc: ComputationDescription<
          RawComputation<any, T> & SubscribableComputation<T>
        >
      ) => Promise<ComputationResult<T>>;
    },
    desc: ComputationDescription<
      RawComputation<any, T> & SubscribableComputation<T>
    >
  ) {
    ctx.checkActive();
    this.requested++;
    const result = await ctx.get(desc);
    if (result.ok && !this.locked) {
      ctx.checkActive();
      if (desc.serializer) {
        this.deps.push([
          desc,
          desc.serializer.valueSerializer.getTag(result.value),
        ]);
      } else {
        // TODO warn about missing serializer
      }
    }
    return result;
  }

  make(value: Res): CacheEntry<Res> | null {
    if (this.requested !== this.deps.length) {
      // There is no point in storing a cache entry if someof its dependencies failed or do not have a tag
      return null;
    }
    this.locked = true;
    return new CacheEntry(value, this.deps);
  }
}

class CacheEntry<Res> {
  constructor(
    readonly value: Res,
    readonly deps: readonly [AnySubscribableDescription, CacheableTag][]
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

  constructor(
    public readonly source: RawComputation<any, Res> & DependentComputation,
    public readonly desc: BasicComputationDescription<Req, Res>
  ) {
    this.db = source.registry.db;
    this.isCacheable = !!desc.serializer;
  }

  async exec(
    baseExec: BasicComputationExec<Req, Res>,
    ctx: BasicComputationContext<Req>
  ): Promise<ComputationResult<Res>> {
    if (!this.isCacheable) {
      return baseExec(ctx);
    }
    const currentEntry = this.db.get(this.desc);
    if (currentEntry) {
      const cached = currentEntry.getValue();
      try {
        const jobs = [];
        for (const [depDesc, tag] of currentEntry.getDeps()) {
          const { serializer } = depDesc;
          if (serializer == null) throw new Error("No serializer?");
          jobs.push(
            ctx.get(depDesc).then(result => {
              if (
                !result.ok ||
                serializer.valueSerializer.getTag(result.value) !== tag
              ) {
                throw new Error("Outdated");
              }
            })
          );
        }
        await Promise.all(jobs);
        return ok(cached);
      } catch (err) {}
    }
    // Check we are still running
    ctx.checkActive();
    // Reset dependencies and cache
    this.source.dependentMixin.invalidateRoutine();
    this.db.delete(this.desc);
    // New entry
    const newEntry = new CacheEntryBuilder<Res>();
    // Execute
    const result = await baseExec({
      ...ctx,
      get: desc => newEntry.getDependency(ctx, desc),
      getOk: desc => promiseIfOk(newEntry.getDependency(ctx, desc)),
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
      this.db.delete(this.desc);
    }
  }

  deleteRoutine() {
    if (this.isCacheable) {
      this.db.delete(this.desc);
    }
  }
}
