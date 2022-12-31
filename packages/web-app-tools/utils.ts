export function noop() {}

export function never(_value: never) {}

// From https://github.com/sindresorhus/type-fest/blob/main/source/opaque.d.ts

declare const tag: unique symbol;

declare type Tagged<Token> = {
  readonly [tag]: Token;
};

export type Opaque<Type, Token = unknown> = Type & Tagged<Token>;

export type ObjRecord<K extends string | number, V> = {
  [P in K]?: V | undefined;
};
