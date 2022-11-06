import { SchemaError } from "./errors";
import { Formatter } from "./format";
import { Path } from "./path";
import { Result } from "./result";

export class SchemaOpCtx {
  private path: Path;
  private readonly errors: SchemaError[];
  private readonly formatter: Formatter;

  constructor(formatter: Formatter) {
    this.path = Path.create();
    this.errors = [];
    this.formatter = formatter;
  }

  pushError(value: unknown, message: string) {
    this.errors.push(this.error(value, message));
  }

  resultError(value: unknown, message: string) {
    return Result.error(this.error(value, message));
  }

  error(value: unknown, message: string) {
    return new SchemaError(value, this.path, message);
  }

  format(value: unknown) {
    const { formatter } = this;
    return formatter(value);
  }

  push(key: string) {
    this.path = this.path.push(key);
  }

  pop() {
    this.path = this.path.pop();
  }

  hasErrors() {
    return this.errors.length === 0;
  }

  getErrors(): readonly SchemaError[] {
    return this.errors;
  }

  directDecode<T>(valid: boolean, whatDesc: string, value: unknown): Result<T> {
    return valid
      ? Result.ok(value as T)
      : Result.error(
          this.error(value, `Expected ${whatDesc} (got ${this.format(value)})`)
        );
  }
}
