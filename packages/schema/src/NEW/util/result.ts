import type { SchemaError } from "./errors";

const OK = { ok: true } as const;

export type ValidationResult =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly errors: readonly SchemaError[];
    };

export const ValidationResult = {
  ok() {
    return OK;
  },
  errors(errors: readonly SchemaError[]) {
    return { ok: false, errors } as const;
  },
};

export type Result<T> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: SchemaError;
    };

export const Result = {
  ok<T>(value: T) {
    return { ok: true, value } as const;
  },
  error(error: SchemaError) {
    return { ok: false, error } as const;
  },
};

export type Option<T> =
  | {
      readonly some: true;
      readonly value: T;
    }
  | {
      readonly some: false;
    };

export function some<T>(value: T): Option<T> {
  return { some: true, value };
}

export function none<T>(): Option<T> {
  return { some: false };
}
