import { Option } from "../../util/monads";
import { impl } from "../../util/traits";
import {
  ComputationRegistry,
  ResultTypeOfComputation,
  type AnyComputationDescription,
  type ComputationDescription,
} from "../incremental-lib";
import { type ValueDefinition, HashMap } from "../utils/hash-map";
import { ComputationResult, ok } from "../utils/result";
import {
  BasicComputationContext,
  BasicComputation,
  BasicComputationDescription,
} from "./basic";
import { SubscribableComputation } from "./mixins/subscribable";
import { AnyRawComputation, RawComputation, State } from "./raw";

export interface Serializable<T> {
  serialize(result: T): Buffer;
  deserialize(result: Buffer): T;
}

// null signals some error or unknown tag
export type CacheableTag = string | null;

export class CacheableValue<T> {
  constructor(readonly value: T) {}

  getTag(): CacheableTag {
    return ""; // TODO
  }

  checkTag(tag: CacheableTag): boolean {
    return tag != null; // TODO
  }

  serialize(): Buffer {
    return Buffer.from([]); // TODO
  }

  static deserialize(buf: Buffer) {
    return new CacheableValue(); // TODO
  }
}

type AnySubscribableDescription = ComputationDescription<
  RawComputation<any, any> & SubscribableComputation<any>
>;

const defaultValDef1: ValueDefinition<AnyComputationDescription> = {
  hash: a => a.hash(),
  equal: (a, b) => a.equal(b),
};

const defaultValDef2: ValueDefinition<AnySubscribableDescription> = {
  hash: a => a.hash(),
  equal: (a, b) => a.equal(b),
};

class CacheEntry<C extends AnyRawComputation> {
  private result: Option<CacheableValue<ResultTypeOfComputation<C>>> =
    Option.none;
  private readonly deps: HashMap<AnySubscribableDescription, CacheableTag> =
    new HashMap(defaultValDef2);

  constructor(readonly desc: ComputationDescription<C>) {}

  addDependency(desc: AnySubscribableDescription, tag: CacheableTag) {
    this.deps.set(desc, tag);
  }

  saveResult(value: CacheableValue<ResultTypeOfComputation<C>>) {
    this.result = Option.some(value);
  }

  getResult() {
    return this.result;
  }

  getDeps() {
    return this.deps[Symbol.iterator]();
  }

  reset() {
    this.result = Option.none;
    this.deps.clear();
  }
}

export class CacheDB {
  private readonly map: HashMap<AnyComputationDescription, CacheEntry<any>> =
    new HashMap(defaultValDef1);

  constructor() {}

  get<C extends AnyRawComputation>(desc: ComputationDescription<C>) {
    return this.map.get(desc) as CacheEntry<C> | undefined;
  }

  set<C extends AnyRawComputation>(desc: ComputationDescription<C>) {
    const entry = new CacheEntry(desc);
    this.map.set(desc, entry);
    return entry;
  }

  delete<C extends AnyRawComputation>(desc: ComputationDescription<C>) {
    this.map.delete(desc);
  }
}

export class CacheableBasicComputation<Req, Res> extends BasicComputation<
  Req,
  Res
> {
  public readonly db: CacheDB;

  constructor(
    registry: ComputationRegistry,
    db: CacheDB,
    description: BasicComputationDescription<Req, Res>,
    mark: boolean = true
  ) {
    super(registry, description, false);
    this.db = db;
    if (mark) this.mark(State.PENDING);
  }

  protected override async exec(
    ctx: BasicComputationContext<Req>
  ): Promise<ComputationResult<Res>> {
    const currentEntry = this.db.get(this.desc);
    if (currentEntry) {
      const cached = currentEntry.getResult();
      // An entry is only considered if it has a value
      if (cached.some) {
        try {
          for (const [depDesc, tag] of currentEntry.getDeps()) {
            const result = await ctx.get(depDesc);
            const valid =
              result.ok &&
              result.value instanceof CacheableValue &&
              result.value.checkTag(tag);
            if (!valid) {
              throw new Error("Outdated");
            }
          }
          return ok(cached.value.value);
        } catch (err) {}
      }
    }
    // Check we are still running
    ctx.checkActive();
    // Reset dependencies
    this.dependentMixin.invalidateRoutine();
    // Replace old entry with new entry
    const newEntry = this.db.set(this.desc);
    // Execute
    const result = await this.config.exec({
      ...ctx,
      get: async desc => saveDep(desc, await ctx.get(desc)),
      getOk: async desc => {
        const result = await ctx.getOk(desc);
        saveDep(desc, ok(result));
        return result;
      },
    });
    // Check we are still running
    ctx.checkActive();
    // On success, save result
    if (result.ok && result.value instanceof CacheableValue) {
      newEntry.saveResult(result.value);
    }
    return result;

    function saveDep<T>(
      desc: ComputationDescription<
        RawComputation<any, T> & SubscribableComputation<T>
      >,
      result: ComputationResult<T>
    ) {
      ctx.checkActive();
      newEntry.addDependency(
        desc,
        result.ok && result.value instanceof CacheableValue
          ? result.value.getTag()
          : null
      );
      return result;
    }
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
