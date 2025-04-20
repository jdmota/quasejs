import {
  type ComputationDescription,
  ComputationRegistry,
} from "../incremental-lib";
import {
  type ValueDefinition,
  HashMap,
  ReadonlyHashMap,
} from "../utils/hash-map";
import { ComputationResult, ok, promiseIfOk } from "../utils/result";
import {
  BasicComputationContext,
  BasicComputation,
  BasicComputationDescription,
} from "./basic";
import { SubscribableComputation } from "./mixins/subscribable";
import { RawComputation, State } from "./raw";

export interface Serializable<T> {
  serialize(result: T): Buffer;
  deserialize(result: Buffer): T;
}

export type CacheableTag = string;

export abstract class CacheableValue<T> {
  constructor(readonly value: T) {}
  abstract getTag(): CacheableTag;
  abstract checkTag(tag: CacheableTag): boolean;
  abstract serialize(): Buffer;
}

type AnySubscribableDescription = ComputationDescription<
  RawComputation<any, any> & SubscribableComputation<any>
>;

const defaultValDef1: ValueDefinition<
  BasicComputationDescription<any, CacheableValue<any>>
> = {
  hash: a => a.hash(),
  equal: (a, b) => a.equal(b),
};

const defaultValDef2: ValueDefinition<AnySubscribableDescription> = {
  hash: a => a.hash(),
  equal: (a, b) => a.equal(b),
};

class CacheEntryBuilder<Res> {
  private readonly deps: HashMap<
    AnySubscribableDescription,
    CacheableTag | null // null signals some error or unknown tag
  > = new HashMap(defaultValDef2);

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
    this.deps.set(desc, null);
    const result = await ctx.get(desc);
    if (result.ok && result.value instanceof CacheableValue) {
      ctx.checkActive();
      this.deps.set(desc, result.value.getTag());
    }
    return result;
  }

  make(value: CacheableValue<Res>) {
    return new CacheEntry(value, this.deps);
  }
}

class CacheEntry<Res> {
  constructor(
    readonly value: CacheableValue<Res>,
    readonly deps: ReadonlyHashMap<
      AnySubscribableDescription,
      CacheableTag | null
    >
  ) {}

  getValue() {
    return this.value;
  }

  getDeps() {
    return this.deps[Symbol.iterator]();
  }
}

export class CacheDB {
  private readonly map: HashMap<
    BasicComputationDescription<any, CacheableValue<any>>,
    CacheEntry<any>
  > = new HashMap(defaultValDef1);

  get<Req, Res>(desc: BasicComputationDescription<Req, CacheableValue<Res>>) {
    return this.map.get(desc) as CacheEntry<Res> | undefined;
  }

  set<Req, Res>(
    desc: BasicComputationDescription<Req, CacheableValue<Res>>,
    entry: CacheEntry<Res>
  ) {
    this.map.set(desc, entry);
  }

  delete<Req, Res>(
    desc: BasicComputationDescription<Req, CacheableValue<Res>>
  ) {
    this.map.delete(desc);
  }

  async save() {
    // TODO
  }

  async load() {
    // TODO
  }
}

export class CacheableBasicComputation<Req, Res> extends BasicComputation<
  Req,
  CacheableValue<Res>
> {
  public readonly db: CacheDB;

  constructor(
    registry: ComputationRegistry,
    db: CacheDB,
    description: BasicComputationDescription<Req, CacheableValue<Res>>,
    mark: boolean = true
  ) {
    super(registry, description, false);
    this.db = db;
    if (mark) this.mark(State.PENDING);
  }

  protected override async exec(
    ctx: BasicComputationContext<Req>
  ): Promise<ComputationResult<CacheableValue<Res>>> {
    const currentEntry = this.db.get(this.desc);
    if (currentEntry) {
      const cached = currentEntry.getValue();
      try {
        await Promise.all(
          Array.from(currentEntry.getDeps()).map(async ([depDesc, tag]) => {
            if (tag == null) {
              throw new Error("Outdated");
            }
            const result = await ctx.get(depDesc);
            const valid =
              result.ok &&
              result.value instanceof CacheableValue &&
              result.value.checkTag(tag);
            if (!valid) {
              throw new Error("Outdated");
            }
          })
        );
        return ok(cached);
      } catch (err) {}
    }
    // Check we are still running
    ctx.checkActive();
    // Reset dependencies and cache
    this.dependentMixin.invalidateRoutine();
    this.db.delete(this.desc);
    // New entry
    const newEntry = new CacheEntryBuilder<Res>();
    // Execute
    const result = await this.config.exec({
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

  protected override invalidateRoutine(): void {
    super.invalidateRoutine();
    this.db.delete(this.desc);
  }

  protected override deleteRoutine(): void {
    super.deleteRoutine();
    this.db.delete(this.desc);
  }
}
