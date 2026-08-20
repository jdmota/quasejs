import { Option } from "../../util/monads";
import { format, type Formatter } from "./format";
import { ValidationResult } from "./result";

export type ObjectKey = string | number | symbol;

export type SchemaError = Readonly<{
  code: string;
  message: string;
}>;

export type SchemaErrorTree = {
  errors: SchemaError[];
  properties?: { [key: ObjectKey]: SchemaErrorTree | undefined };
  items?: (SchemaErrorTree | undefined)[];
};

export type SchemaOpCtxOpts = {
  readonly formatter?: Formatter;
  readonly abortEarly?: boolean;
};

export class SchemaOpCtx implements SchemaOpCtxOpts {
  private ok: boolean;
  private readonly errorTree: SchemaErrorTree[];
  public readonly formatter: Formatter;
  public readonly abortEarly: boolean;
  private readonly busy: WeakSet<WeakKey>;

  constructor(opts: SchemaOpCtxOpts | SchemaOpCtx = {}) {
    this.ok = true;
    this.errorTree = [{ errors: [] }];
    this.formatter = opts.formatter ?? format;
    this.abortEarly = opts.abortEarly ?? true;
    this.busy = new WeakSet();
  }

  static new(ctx: SchemaOpCtxOpts | SchemaOpCtx = {}) {
    return new SchemaOpCtx(ctx);
  }

  some<T>(value: T) {
    return Option.some(value);
  }

  public readonly none = Option.none;

  format(value: unknown) {
    const { formatter } = this;
    return formatter(value);
  }

  isOK() {
    return this.ok;
  }

  shouldAbort() {
    return this.abortEarly && !this.ok;
  }

  addError(code: string, message: string) {
    this.ok = false;
    this.errorTree.at(-1)!.errors.push({
      code,
      message,
    });
  }

  error(code: string, message: string) {
    this.addError(code, message);
    return this.none;
  }

  result<T>(value: T) {
    return this.ok ? this.some(value) : this.none;
  }

  validationResult(opt: Option<any>): ValidationResult<any, any> {
    return this.ok && opt.some
      ? ValidationResult.ok(opt.value)
      : ValidationResult.errors(this.errorTree.at(-1)!);
  }

  push() {
    this.errorTree.push({ errors: [] });
  }

  popKey(key: string | symbol) {
    const tree = this.errorTree.pop()!;
    if (tree.errors.length > 0) {
      const parent = this.errorTree.at(-1)!;
      parent.properties ??= {};
      parent.properties[key] = tree;
    }
  }

  popIdx(key: number) {
    const tree = this.errorTree.pop()!;
    if (tree.errors.length > 0) {
      const parent = this.errorTree.at(-1)!;
      parent.items ??= [];
      parent.items[key] = tree;
    }
  }

  popCtx(addCtxInfo: (tree: SchemaErrorTree) => SchemaError) {
    const tree = this.errorTree.pop()!;
    if (tree.errors.length > 0) {
      const parent = this.errorTree.at(-1)!;
      parent.errors.push(addCtxInfo(tree));
    }
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
