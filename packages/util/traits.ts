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
  static readonly sym: typeof EXAMPLE_TRAIT = EXAMPLE_TRAIT;

  method(self: Self, value: number) {
    return value;
  }

  static method<Self extends Example>(self: Self, value: number) {
    return (
      self as unknown as Example & { [EXAMPLE_TRAIT]: ExampleTrait<Self> }
    )[EXAMPLE_TRAIT].method(self, value);
  }
}

impl(Example, ExampleTrait);

console.log(ExampleTrait.method(new Example(), 20));
