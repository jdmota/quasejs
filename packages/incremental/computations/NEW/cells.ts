import { serializationDB } from "../../utils/serialization-db";
import type { IncrementalFunctionCallDescription } from "./functions";

export class IncrementalCellDescription<Value> {
  _valueType!: Value;

  constructor(
    readonly owner: IncrementalFunctionCallDescription<any, any, any>,
    readonly key: string,
    readonly index: number,
    readonly resolved: boolean
  ) {}

  equal(other: unknown): boolean {
    return (
      other instanceof IncrementalCellDescription &&
      this.owner.equal(other.owner) &&
      this.key === other.key &&
      this.index === other.index &&
      this.resolved === other.resolved
    );
  }

  hash() {
    return this.owner.hash() + this.key.length + this.index;
  }

  getCacheKey() {
    return `Cell{${this.owner.getCacheKey()},${this.key},${this.index},${this.resolved}}`;
  }
}

export type IncrementalCellDescriptionJSON = {
  readonly owner: IncrementalFunctionCallDescription<any, any, any>;
  readonly key: string;
  readonly index: number;
  readonly resolved: boolean;
};

serializationDB.register<
  IncrementalCellDescription<any>,
  IncrementalCellDescriptionJSON
>(IncrementalCellDescription, {
  name: "IncrementalCellDescription",
  serialize: value => {
    return {
      owner: value.owner,
      key: value.key,
      index: value.index,
      resolved: value.resolved,
    };
  },
  deserialize: out => {
    return new IncrementalCellDescription(
      out.owner,
      out.key,
      out.index,
      out.resolved
    );
  },
});
