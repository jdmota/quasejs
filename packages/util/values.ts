import type { InspectContext, inspect } from "node:util";
import { className, isObject } from "./miscellaneous";

export const $EQUALS = Symbol.for("quase.equals");
export const $HASHCODE = Symbol.for("quase.hashCode");
export const $SERIALIZE = Symbol.for("quase.serialize");
export const $DESERIALIZE = Symbol.for("quase.deserialize");
export const $FORMAT = Symbol.for("quase.format");
export const $INSPECT = Symbol.for("nodejs.util.inspect.custom");

export type SerializeResult<T> = Readonly<{
  name: string;
  version: number;
  value: T;
}>;

export type $EQUALS_FN = (other: unknown) => boolean;
export type $HASHCODE_FN = () => number;
export type $SERIALIZE_FN<T> = () => SerializeResult<T>;
export type $DESERIALIZE_FN<S, O> = (serialized: SerializeResult<S>) => O;
export type $FORMAT_FN = () => string;
export type $INSPECT_FN = (
  depth: number,
  options: InspectContext,
  _inspect: typeof inspect
) => string;

export interface EqualsTrait {
  [$EQUALS]: $EQUALS_FN;
}

export interface HashCodeTrait {
  [$HASHCODE]: $HASHCODE_FN;
}

export interface SerializeTrait<T> {
  [$SERIALIZE]: $SERIALIZE_FN<T>;
}

export interface FormatTrait {
  [$FORMAT]: $FORMAT_FN;
}

export interface InspectTrait {
  [$INSPECT]: $INSPECT_FN;
}

export function valueHasEquals(v: unknown): v is EqualsTrait {
  return isObject(v) && (v as any)[$EQUALS] != null;
}

export function valueEquals(a: unknown, b: unknown): boolean {
  return valueHasEquals(a) ? a[$EQUALS](b) : Object.is(a, b);
}

export function valueHasHashCode(v: unknown): v is HashCodeTrait {
  return isObject(v) && (v as any)[$HASHCODE] != null;
}

export function valueHashCode(v: unknown): number {
  return valueHasHashCode(v) ? v[$HASHCODE]() : 0;
}

export function valueHasFormat(v: unknown): v is FormatTrait {
  return isObject(v) && (v as any)[$FORMAT] != null;
}

export function valueFormat(v: unknown): string {
  return valueHasFormat(v)
    ? v[$FORMAT]()
    : isObject(v)
      ? className(v)
      : String(v);
}
