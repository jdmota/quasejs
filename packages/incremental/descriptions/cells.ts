import { serializationRegistry } from "../utils/serialization-db";
import {
  type FormatTrait,
  type SerializeResult,
  type SerializeTrait,
  $EQUALS,
  $FORMAT,
  $HASHCODE,
  $SERIALIZE,
} from "../../util/values";
import type { WithCacheKey } from "../cache/cache-db";
import type {
  AnyIncrementalFunctionCallDescription,
  IncrementalFunctionCallDescription,
} from "./functions";

export interface IncrementalCellOwnerDescription
  extends WithCacheKey,
    FormatTrait {}

export abstract class IncrementalCellDescription<Value>
  implements WithCacheKey, SerializeTrait<any>, FormatTrait
{
  _valueType!: Value;
  constructor(readonly owner0: IncrementalCellOwnerDescription) {}
  abstract getCacheKey(): string;
  abstract [$EQUALS](other: unknown): boolean;
  abstract [$HASHCODE](): number;
  abstract [$FORMAT](): string;
  abstract [$SERIALIZE](): SerializeResult<any>;
}

export type ResultOfCellDesc<D> =
  D extends IncrementalCellDescription<infer Value> ? Value : never;

export type AnyIncrementalCellDescription = IncrementalCellDescription<any>;

export class IncrementalAllocatedCellDescription<
  Value,
> extends IncrementalCellDescription<Value> {
  constructor(
    readonly owner: IncrementalCellOwnerDescription,
    readonly key: string,
    readonly index: number
  ) {
    super(owner);
  }

  [$EQUALS](other: unknown): boolean {
    return (
      other instanceof IncrementalAllocatedCellDescription &&
      this.owner[$EQUALS](other.owner) &&
      this.key === other.key &&
      this.index === other.index
    );
  }

  [$HASHCODE]() {
    return this.owner[$HASHCODE]() + this.key.length + this.index;
  }

  getCacheKey() {
    return `AllocatedCell{${this.owner.getCacheKey()},${this.key},${this.index}}`;
  }

  [$FORMAT]() {
    return `${this.owner[$FORMAT]()}[${this.key}][${this.index}]`;
  }

  [$SERIALIZE]() {
    return {
      name: "IncrementalAllocatedCellDescription",
      version: 1,
      value: {
        owner: this.owner,
        key: this.key,
        index: this.index,
      } satisfies IncrementalAllocatedCellDescriptionJSON,
    };
  }
}

type IncrementalAllocatedCellDescriptionJSON = {
  readonly owner: IncrementalCellOwnerDescription;
  readonly key: string;
  readonly index: number;
};

serializationRegistry.registerDeserializer<
  IncrementalAllocatedCellDescriptionJSON,
  IncrementalAllocatedCellDescription<any>
>("IncrementalAllocatedCellDescription", ({ value }) => {
  return new IncrementalAllocatedCellDescription(
    value.owner,
    value.key,
    value.index
  );
});

export class IncrementalOutputCellDescription<
  Output,
> extends IncrementalCellDescription<Output> {
  constructor(
    readonly owner: IncrementalFunctionCallDescription<any, Output, any>
  ) {
    super(owner);
  }

  [$EQUALS](other: unknown): boolean {
    return (
      other instanceof IncrementalOutputCellDescription &&
      this.owner[$EQUALS](other.owner)
    );
  }

  [$HASHCODE]() {
    return this.owner[$HASHCODE]();
  }

  getCacheKey() {
    return `OutputCell{${this.owner.getCacheKey()}}`;
  }

  [$FORMAT]() {
    return `${this.owner[$FORMAT]()}#output`;
  }

  [$SERIALIZE]() {
    return {
      name: "IncrementalOutputCellDescription",
      version: 1,
      value: {
        owner: this.owner,
      } satisfies IncrementalOutputCellDescriptionJSON,
    };
  }
}

type IncrementalOutputCellDescriptionJSON = {
  readonly owner: AnyIncrementalFunctionCallDescription;
};

serializationRegistry.registerDeserializer<
  IncrementalOutputCellDescriptionJSON,
  IncrementalOutputCellDescription<any>
>("IncrementalOutputCellDescription", ({ value }) => {
  return new IncrementalOutputCellDescription(value.owner);
});
