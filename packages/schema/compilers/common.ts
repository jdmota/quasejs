import type { Class } from "type-fest";
import type { SchemaType } from "../schema-type";
import { UniqueNames } from "../../util/unique-names";

export type SchemaCompilerImpl<T extends SchemaType, Ctx> = (
  type: T,
  ctx: Ctx
) => void;

export class SchemaCompilersRegistry<Ctx> {
  private readonly impls = new WeakMap<
    Class<SchemaType>,
    SchemaCompilerImpl<SchemaType, Ctx>
  >();

  constructor(readonly kind: string) {}

  register<T extends SchemaType>(
    clazz: Class<T>,
    impl: SchemaCompilerImpl<T, Ctx>
  ) {
    this.impls.set(clazz, impl as SchemaCompilerImpl<any, Ctx>);
  }

  compile<T extends SchemaType>(type: T, ctx: Ctx) {
    const cons = (type as any).constructor;
    const impl = this.impls.get(cons) as SchemaCompilerImpl<T, Ctx> | undefined;

    if (impl) {
      impl(type, ctx);
    } else {
      throw new Error(`Cannot find ${this.kind} compiler for '${cons?.name}'`);
    }
  }
}

export type SchemaCompilerHelpers<K extends string> = {
  readonly [key in K]:
    | string
    | Readonly<{
        code: string;
        dependencies: readonly K[];
      }>;
};

export abstract class BaseSchemaCompiler<Registry, K extends string, Result> {
  readonly names: UniqueNames;
  protected readonly usedHelpers: Map<K, string>;
  protected readonly compiled: Map<SchemaType, Result>;

  constructor(
    readonly registry: Registry,
    readonly helpers: SchemaCompilerHelpers<K>
  ) {
    this.names = new UniqueNames(Object.keys(helpers));
    this.usedHelpers = new Map();
    this.compiled = new Map();
  }

  helper(kind: K) {
    if (!this.usedHelpers.has(kind)) {
      const helper = this.helpers[kind];
      if (typeof helper === "string") {
        this.usedHelpers.set(kind, helper);
      } else {
        for (const dep of helper.dependencies) {
          this.helper(dep);
        }
        this.usedHelpers.set(kind, helper.code);
      }
    }
    return kind;
  }

  abstract compile(type: SchemaType): void;
  abstract toString(): string;
}
