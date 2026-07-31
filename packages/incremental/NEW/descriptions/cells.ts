import { serializationDB } from "../../utils/serialization-db";
import type { WithCacheKey } from "../cache/cache-db";
import type {
  AnyIncrementalFunctionCallDescription,
  IncrementalFunctionCallDescription,
} from "./functions";

export interface IncrementalCellOwnerDescription extends WithCacheKey {
  equal(other: unknown): boolean;
  hash(): number;
  getCacheKey(): string;
  format(): string;
}

export abstract class IncrementalCellDescription<Value>
  implements WithCacheKey
{
  _valueType!: Value;
  constructor(readonly owner0: IncrementalCellOwnerDescription) {}
  abstract equal(other: unknown): boolean;
  abstract hash(): number;
  abstract format(): string;
  abstract getCacheKey(): string;
}

export type ResultOfCellDesc<D> =
  D extends IncrementalCellDescription<infer Value> ? Value : never;

export type AnyIncrementalCellDescription = IncrementalCellDescription<any>;

export class IncrementalAllocatedCellDescription<
  Value,
> extends IncrementalCellDescription<Value> {
  constructor(
    readonly owner: AnyIncrementalFunctionCallDescription,
    readonly key: string,
    readonly index: number
  ) {
    super(owner);
  }

  equal(other: unknown): boolean {
    return (
      other instanceof IncrementalAllocatedCellDescription &&
      this.owner.equal(other.owner) &&
      this.key === other.key &&
      this.index === other.index
    );
  }

  hash() {
    return this.owner.hash() + this.key.length + this.index;
  }

  getCacheKey() {
    return `AllocatedCell{${this.owner.getCacheKey()},${this.key},${this.index}}`;
  }

  format() {
    return `${this.owner.format()}[${this.key}][${this.index}]`;
  }
}

type IncrementalAllocatedCellDescriptionJSON = {
  readonly owner: AnyIncrementalFunctionCallDescription;
  readonly key: string;
  readonly index: number;
};

serializationDB.register<
  IncrementalAllocatedCellDescription<any>,
  IncrementalAllocatedCellDescriptionJSON
>(IncrementalAllocatedCellDescription, {
  name: "IncrementalAllocatedCellDescription",
  serialize: value => {
    return {
      owner: value.owner,
      key: value.key,
      index: value.index,
    };
  },
  deserialize: out => {
    return new IncrementalAllocatedCellDescription(
      out.owner,
      out.key,
      out.index
    );
  },
});

export class IncrementalOutputCellDescription<
  Output,
> extends IncrementalCellDescription<Output> {
  constructor(
    readonly owner: IncrementalFunctionCallDescription<any, Output, any>
  ) {
    super(owner);
  }

  equal(other: unknown): boolean {
    return (
      other instanceof IncrementalOutputCellDescription &&
      this.owner.equal(other.owner)
    );
  }

  hash() {
    return this.owner.hash();
  }

  getCacheKey() {
    return `OutputCell{${this.owner.getCacheKey()}}`;
  }

  format() {
    return `${this.owner.format()}#output`;
  }
}

type IncrementalOutputCellDescriptionJSON = {
  readonly owner: AnyIncrementalFunctionCallDescription;
};

serializationDB.register<
  IncrementalOutputCellDescription<any>,
  IncrementalOutputCellDescriptionJSON
>(IncrementalOutputCellDescription, {
  name: "IncrementalOutputCellDescription",
  serialize: value => {
    return {
      owner: value.owner,
    };
  },
  deserialize: out => {
    return new IncrementalOutputCellDescription(out.owner);
  },
});
