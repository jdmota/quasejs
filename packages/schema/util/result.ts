import type { SchemaErrorTree } from "./context";

export type ValidationOK<T> = {
  readonly ok: true;
  readonly value: T;
};

export type ValidationError<E> = {
  readonly ok: false;
  readonly errors: E;
};

export type ValidationResult<T, E> = ValidationOK<T> | ValidationError<E>;

export type ValidationResultMaybeAsync<T, E> =
  ValidationResult<T, E> | Promise<ValidationResult<T, E>>;

export const ValidationResult = {
  ok<T>(value: T): ValidationOK<T> {
    return { ok: true, value };
  },
  errors<E>(errors: E): ValidationError<E> {
    return { ok: false, errors };
  },
};
