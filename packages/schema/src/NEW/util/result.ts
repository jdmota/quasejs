import type { SchemaError } from "./errors";

export type ValidationOK<T> = {
  readonly ok: true;
  readonly value: T;
};

export type ValidationError = {
  readonly ok: false;
  readonly errors: readonly SchemaError[];
};

export type ValidationResult<T> = ValidationOK<T> | ValidationError;

export type ValidationResultMaybeAsync<T> =
  | ValidationResult<T>
  | Promise<ValidationResult<T>>;

export const ValidationResult = {
  ok<T>(value: T): ValidationOK<T> {
    return { ok: true, value };
  },
  error(error: SchemaError): ValidationError {
    return { ok: false, errors: [error] };
  },
  errors(errors: readonly SchemaError[]): ValidationError {
    return { ok: false, errors };
  },
};

export type TransformResult<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly errors: readonly SchemaError[];
    };

export const TransformResult = {
  ok<T>(value: T): TransformResult<T> {
    return { ok: true, value };
  },
  error<T>(error: SchemaError): TransformResult<T> {
    return { ok: false, errors: [error] };
  },
  errors<T>(errors: readonly SchemaError[]): TransformResult<T> {
    return { ok: false, errors };
  },
};

export function then<A, B>(
  value: A | Promise<A>,
  fn: (value: A) => B | Promise<B>
) {
  if (value instanceof Promise) {
    return value.then(fn);
  }
  return fn(value);
}
