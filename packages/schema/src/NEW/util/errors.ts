import type { Path } from "./path";

export class SchemaError {
  readonly path: Path;
  readonly message: string;
  constructor(path: Path, message: string) {
    this.path = path;
    this.message = message;
  }
}
