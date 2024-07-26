export type Result<T, E = Error> =
  | {
      readonly ok: true;
      readonly value: T;
    }
  | {
      readonly ok: false;
      readonly error: E;
    };

export const Result = {
  ok<T>(value: T) {
    return { ok: true, value } as const;
  },
  error<E = Error>(error: E) {
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
