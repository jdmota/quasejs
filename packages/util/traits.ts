const TRAITS = Symbol("traits");

export type TraitableClass<T> = {
  new (...args: unknown[]): T;
  prototype: Pick<T, keyof T>;
  [TRAITS]?: TraitClass<unknown, symbol>[];
};

export type TraitClass<T, S extends symbol> = {
  new (...args: unknown[]): T;
  prototype: Pick<T, keyof T>;
  readonly sym: S;
};

export abstract class Traitable {
  constructor() {
    const self = this as any;
    let clazz = self.constructor;
    while (clazz !== Traitable) {
      const traits = (clazz as TraitableClass<any>)[TRAITS] ?? [];
      for (const trait of traits) {
        if (!self[trait.sym]) {
          self[trait.sym] = new trait();
        }
      }
      clazz = Object.getPrototypeOf(clazz);
    }
  }
}

export function impl<C extends Traitable, T, S extends symbol>(
  clazz: TraitableClass<C>,
  traitClass: TraitClass<T, S>
) {
  (clazz[TRAITS] = clazz[TRAITS] ?? []).push(traitClass);
}

// Experiment

class Example extends Traitable {}

const EXAMPLE_TRAIT = Symbol("exampleTrait");

class ExampleTrait<Self extends Example> {
  static readonly sym = EXAMPLE_TRAIT;

  method(self: Self, value: number) {
    return value;
  }

  static method<Self extends Example>(self: Self, value: number) {
    return (self as any as Example & { [EXAMPLE_TRAIT]: ExampleTrait<Self> })[
      EXAMPLE_TRAIT
    ].method(self, value);
  }
}

impl(Example, ExampleTrait);

// console.log(ExampleTrait.method(new Example(), 20));

// Alternative

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
    ? typeof REQUIRED | AddSelf<T, T[key]>
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
