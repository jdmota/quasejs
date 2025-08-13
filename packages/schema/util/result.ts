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
