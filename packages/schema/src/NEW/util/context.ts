import { type JsType } from "../types/js-types";
import { SchemaError } from "./errors";
import { format, Formatter } from "./format";
import { Path } from "./path";
import { ValidationError, ValidationResult } from "./result";

export type SchemaOpCtxOpts = {
  formatter?: Formatter;
  abortEarly?: boolean;
  allowCircular?: boolean;
};

export class SchemaOpCtx {
  private path: Path;
  private readonly errorArr: SchemaError[];
  public readonly formatter: Formatter;
  public readonly abortEarly: boolean;
  public readonly allowCircular: boolean;
  private readonly busy: WeakMap<WeakKey, Set<JsType<any>>>;

  constructor(opts: SchemaOpCtxOpts | SchemaOpCtx = {}) {
    this.path = Path.create();
    this.errorArr = [];
    this.formatter = opts.formatter ?? format;
    this.abortEarly = opts.abortEarly ?? false;
    this.allowCircular = opts.allowCircular ?? false;
    this.busy = new WeakMap();
  }

  static new(ctx: SchemaOpCtxOpts | SchemaOpCtx) {
    return new SchemaOpCtx(ctx);
  }

  shouldAbort() {
    return this.abortEarly && this.errorArr.length > 0;
  }

  createError(message: string) {
    return new SchemaError(this.path, message);
  }

  addError(message: string) {
    this.errorArr.push(this.createError(message));
  }

  format(value: unknown) {
    const { formatter } = this;
    return formatter(value);
  }

  push(key: string | number, inKey = false) {
    this.path = this.path.push(key, inKey);
  }

  pop() {
    this.path = this.path.pop();
  }

  hasErrors() {
    return this.errorArr.length === 0;
  }

  getErrors(): readonly SchemaError[] {
    return this.errorArr;
  }

  error(message: string): ValidationError {
    this.addError(message);
    return ValidationResult.errors(this.errorArr);
  }

  result<T>(value: T): ValidationResult<T> {
    return this.errorArr.length === 0
      ? ValidationResult.ok(value as T)
      : ValidationResult.errors(this.errorArr);
  }

  returnErrors() {
    return ValidationResult.errors(this.errorArr);
  }

  validate<T>(
    valid: boolean,
    whatDesc: string,
    value: unknown
  ): ValidationResult<T> {
    if (!valid) {
      this.addError(`Expected ${whatDesc} (got ${this.format(value)})`);
    }
    return this.result(value as T);
  }

  transferTo(ctx: SchemaOpCtx) {
    for (const error of ctx.errorArr) {
      ctx.errorArr.push(error);
    }
  }

  resetErrors() {
    this.errorArr.length = 0;
  }

  pushValue(value: unknown, type: JsType<any>) {
    if (typeof value === "object" && value != null) {
      const seenTypes = this.busy.get(value);
      if (seenTypes) {
        if (seenTypes.has(type)) {
          if (!this.allowCircular) {
            this.addError("Circular reference");
          }
          return false;
        } else {
          seenTypes.add(type);
        }
      } else {
        this.busy.set(value, new Set([type]));
      }
    }
    return true;
  }

  popValue(value: unknown) {
    if (typeof value === "object" && value != null) {
      this.busy.delete(value);
    }
  }
}
