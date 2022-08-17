export type TraitType<T extends TraitType<T>> = {
  [key in keyof T]: T[key] extends (...args: any[]) => any
    ? (/*self: T, */ ...args: never[]) => unknown
    : unknown;
};

type AddSelf<T, M> = M extends (...args: infer A) => infer R
  ? (self: T, ...args: A) => R
  : never;

export const REQUIRED = Symbol("required");

type AsKey<T, K extends keyof T> = T[K] extends (...args: any[]) => any
  ? K
  : never;

export type Impl<T extends TraitType<T>> = {
  [key in keyof T as AsKey<T, key>]: T[key] extends (...args: any[]) => any
    ? /*typeof REQUIRED | */ AddSelf<T, T[key]>
    : never;
};

export function createTrait<T extends TraitType<T>, I extends Impl<T>>(
  impl: I
) {
  return impl;
}

type MyTrait = {
  x: number;
  set(x: number): void;
  get(): boolean;
};

const myTrait = createTrait({
  set: REQUIRED,
  get(self: MyTrait) {
    return self.x > 0;
  },
});
