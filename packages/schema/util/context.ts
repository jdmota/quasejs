import { assertion } from "../../util/miscellaneous";
import { SchemaError } from "./errors";
import { format, type Formatter } from "./format";
import { Path } from "./path";
import { type ValidationError, ValidationResult } from "./result";

export type SchemaOpCtxOpts = {
  readonly formatter?: Formatter;
  readonly abortEarly?: boolean;
};

export class SchemaOpCtx implements SchemaOpCtxOpts {
  private path: Path;
  private readonly errorArr: SchemaError[];
  public readonly formatter: Formatter;
  public readonly abortEarly: boolean;
  private readonly busy: WeakSet<WeakKey>;

  constructor(opts: SchemaOpCtxOpts | SchemaOpCtx = {}) {
    this.path = Path.create();
    this.errorArr = [];
    this.formatter = opts.formatter ?? format;
    this.abortEarly = opts.abortEarly ?? true;
    this.busy = new WeakSet();
  }

  static new(ctx: SchemaOpCtxOpts | SchemaOpCtx = {}) {
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

  push(key: string | number | null, context: string | null = null) {
    this.path = this.path.push(key, context);
  }

  pop() {
    this.path = this.path.pop();
  }

  isOK() {
    return this.errorArr.length === 0;
  }

  hasErrors() {
    return this.errorArr.length > 0;
  }

  error(message: string): ValidationError {
    this.addError(message);
    return ValidationResult.errors(this.errorArr);
  }

  returnErrors() {
    assertion(this.hasErrors());
    return ValidationResult.errors(this.errorArr);
  }

  result<T>(value: T): ValidationResult<T> {
    return this.errorArr.length === 0
      ? ValidationResult.ok(value as T)
      : ValidationResult.errors(this.errorArr);
  }

  resetErrors() {
    this.errorArr.length = 0;
  }

  pushValue(value: unknown) {
    if (typeof value === "object" && value != null) {
      if (this.busy.has(value)) {
        return false;
      }
      this.busy.add(value);
    }
    return true;
  }

  popValue(value: unknown) {
    if (typeof value === "object" && value != null) {
      this.busy.delete(value);
    }
  }
}
