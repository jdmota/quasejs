import type { SchemaErrorTree } from "./context";

export type ValidationOK<T> = {
  readonly ok: true;
  readonly value: T;
};

export type ValidationError = {
  readonly ok: false;
  readonly tree: SchemaErrorTree;
};

export type ValidationResult<T> = ValidationOK<T> | ValidationError;

export type ValidationResultMaybeAsync<T> =
  ValidationResult<T> | Promise<ValidationResult<T>>;

export const ValidationResult = {
  ok<T>(value: T): ValidationOK<T> {
    return { ok: true, value };
  },
  errors(tree: SchemaErrorTree): ValidationError {
    return { ok: false, tree };
  },
};
