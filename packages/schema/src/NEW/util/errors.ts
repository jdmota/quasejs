import type { Path } from "./path";

export class SchemaError {
  readonly value: unknown;
  readonly path: Path;
  readonly message: string;
  constructor(value: unknown, path: Path, message: string) {
    this.value = value;
    this.path = path;
    this.message = message;
  }
}
