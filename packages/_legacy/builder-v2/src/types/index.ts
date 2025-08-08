/* eslint-disable @typescript-eslint/no-empty-interface */
import {
  BuilderUtil,
  TransformContext,
  ResolveContext,
} from "../plugins/context";
import { Diagnostic } from "../utils/error";
import { Loc, EnvContext, DependencyRequest, AssetRequest } from "./generated";

export * from "./generated";

// Util types

export type ObjValues<T> = T extends { [key: string]: infer U } ? U : never;

export type ObjKey = string | number | symbol;

// https://github.com/microsoft/TypeScript/issues/12936#issuecomment-559034150
// type Exact<T, R> = T extends R ? (R extends T ? T : never) : never;

// This does not seem to work with something like Exact<"a" | "b", "a" | "b">
// "extends" relationship with string unions seems to lose information
// Workaround by creating an object type, and using that to test the "extends" relationship
// We know that "a" <: "a" | "b" and that { a, b } <: { a }
// But since we test "extends" in both directions, the following is fine

type Exact<T extends ObjKey, R extends ObjKey> = Record<T, null> extends Record<
  R,
  null
>
  ? Record<R, null> extends Record<T, null>
    ? T
    : never
  : never;

type Never1 = Exact<"a", "a" | "b">;
type Never2 = Exact<"a" | "b", "a">;
type OK = Exact<"a", "a">;

export type CheckKeys<T, U> = Exact<keyof T, keyof U> extends never ? never : T;

// https://github.com/microsoft/TypeScript/issues/13298#issuecomment-479694102
/*type ExtraOrMissing<Props, Values> =
  | Exclude<Props, Values>
  | Exclude<Values, Props>;
export type CheckKeys<T, U> = ExtraOrMissing<keyof T, keyof U> extends never
  ? T
  : never;
type Values<T> = T extends { [index: number]: infer E } ? E : never;
export type CheckKeysArray<T, U> = ExtraOrMissing<
  keyof T,
  Values<U>
> extends never
  ? T
  : never;*/

// https://github.com/sindresorhus/type-fest/blob/master/source/except.d.ts
type Except<O, K extends keyof O> = Pick<O, Exclude<keyof O, K>>;

type Others =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | undefined
  | null
  | Function
  | Date;

interface DeepReadonlySet<E> extends ReadonlySet<DeepReadonly<E>> {}
interface DeepReadonlyMap<K, V>
  extends ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>> {}
interface DeepReadonlyArray<E> extends ReadonlyArray<DeepReadonly<E>> {}
type OmittedUint8ArrayKeys = "copyWithin" | "fill" | "reverse" | "set" | "sort";
type ReadonlyUint8Array = Readonly<Except<Uint8Array, OmittedUint8ArrayKeys>>;
type OmmitedBufferKeys =
  | OmittedUint8ArrayKeys
  | "swap16"
  | "swap32"
  | "swap64"
  | "write"; // Incomplete
type ReadonlyBuffer = Readonly<Except<Buffer, OmmitedBufferKeys>>;

export type DeepReadonly<T> = T extends Others
  ? T
  : T extends Map<infer K, infer V>
  ? DeepReadonlyMap<K, V>
  : T extends Set<infer U>
  ? DeepReadonlySet<U>
  : T extends (infer E)[]
  ? DeepReadonlyArray<E>
  : T extends {}
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : never;

export type ComplexDeepReadonly<T> = T extends Others
  ? T
  : T extends Map<infer K, infer V>
  ? DeepReadonlyMap<K, V>
  : T extends Set<infer U>
  ? DeepReadonlySet<U>
  : T extends (infer E)[]
  ? DeepReadonlyArray<E>
  : T extends Buffer
  ? ReadonlyBuffer
  : T extends Uint8Array
  ? ReadonlyUint8Array
  : T extends {}
  ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
  : never;

export type Optional<T> = T | null | undefined;

export type MaybeAsync<T> = T | Promise<T>;
export type MaybeAsyncOptional<T> = MaybeAsync<Optional<T>>;

export type ThingOrArray<T> = T | T[];

export type ValOrError<T, E = unknown> =
  | readonly [T, null]
  | readonly [null, E];

// Types

export type Data = Buffer | string | Uint8Array;

export type ImmutableData = ComplexDeepReadonly<Data>;

export type DataType = "buffer" | "string" | "uint8array";

export type Engines = DeepReadonly<{
  browsers: string[];
  electron: Optional<string>;
  node: Optional<string>;
  quaseBuilder: Optional<string>;
}>;

export type Target = DeepReadonly<{
  name: string;
  distDir?: Optional<string>;
  publicUrl?: Optional<string>;
  engines?: Optional<Engines>;
  optimization?: OptimizationOptions;
  outputFormat?: Optional<string>;
  isLibrary?: Optional<string>;
}>;

export type AstInfo = {
  type: string;
  version: string;
  isDirty: boolean;
  program: any;
};

export type SourceMap = any;

export type Meta = Readonly<{ [key: string]: any }>;

export type MutableAsset = {
  id?: Optional<string>;
  type: string;
  data: Data;
  ast?: Optional<AstInfo>;
  map?: Optional<SourceMap>;
  dependencies: DependencyRequest[];
  importedNames: ImportedName[];
  exportedNames: ExportedName[];
  meta?: Optional<Meta>;
  target: string;
  env?: Optional<EnvContext[]>;
  sideEffects?: Optional<boolean>;
  inline?: Optional<"sync" | "async">;
  isolated?: Optional<boolean>; // TODO ???
  splittable?: Optional<boolean>; // TODO ???
};

export type ImmutableAsset = ComplexDeepReadonly<Omit<MutableAsset, "id">> & {
  readonly id: string;
};

export type ImmutableAssets = readonly ImmutableAsset[];

export type Processed = Readonly<{
  request: AssetRequest;
  assets: ImmutableAssets;
  id: number;
}>;

export type ResolvedDependency = DeepReadonly<
  | {
      assetRequest: AssetRequest;
      deferTransform?: Optional<boolean>;
      sideEffects?: Optional<boolean>;
      optional?: Optional<boolean>;
      external: false;
    }
  | {
      assetRequest: null;
      sideEffects?: Optional<boolean>;
      optional?: Optional<boolean>;
      external: true;
    }
>;

export type ImportedName = DeepReadonly<{
  request: string;
  imported: string;
  name: string;
  loc: Optional<Loc>;
}>;

export type ExportedName = DeepReadonly<{
  request: Optional<string>;
  imported: Optional<string>;
  name: string;
  loc: Optional<Loc>;
}>;

export type GenerateOutput = {
  data: Data;
  map: Optional<SourceMap>;
};

export type WatchedFileInfo = { time: number; onlyExistance?: boolean };
export type WatchedFiles = Map<string, WatchedFileInfo>;

export type Manifest = {
  // List of all the files
  files: string[];
  // Mapping from module id to files needed synchronously to load that module
  // They must be fetched before that module can be loaded
  moduleToAssets: Map<string, string[]>;
};

// Like the above, but:
// - Might not contain all the files (only the necessary)
// - Uses numbers to reduce size: each number is the index in the file array
export type RuntimeManifest = {
  f: string[];
  m: { [key: string]: number[] };
};

export type FinalModule = Readonly<{
  id: string;
}>;

export type FinalAsset = {
  relativeDest: string;
  hash: string | null;
  isEntry: boolean;
  runtime: {
    code: string | null;
    manifest: RuntimeManifest | null;
  };
  manifest: Manifest;
  module: FinalModule;
  srcs: Map<string, FinalModule>;
  inlineAssets: FinalAsset[];
};

export type ProcessedGraph = DeepReadonly<{
  hashIds: Map<string, string>;
  moduleToFile: Map<FinalModule, FinalAsset>;
  files: FinalAsset[];
  moduleToAssets: { [id: string]: string[] };
}>;

export type ToWrite = ComplexDeepReadonly<{
  data: Data;
  map: Optional<SourceMap>;
}>;

export type PerformanceOpts = {
  hints: boolean | "warning" | "error";
  maxEntrypointSize: number;
  maxAssetSize: number;
  assetFilter: (asset: string) => boolean;
};

export type Info = {
  moduleId: string;
  file: string;
  hash: string | null;
  size: number;
  isEntry: boolean;
};

export type FileUpdates = {
  added: string[];
  changed: string[];
  removed: string[];
};

export type HmrInfo = {
  hostname: string;
  port: number;
};

export type HmrUpdate = Readonly<{
  updates: Readonly<{
    id: string;
    file: string | null;
    prevFile: string | null;
    reloadApp: boolean;
  }>[];
  moduleToAssets: Readonly<{ [id: string]: string[] }>;
}>;

export type HmrUpdateMsg = {
  type: "update";
  update: HmrUpdate;
};

export type HmrErrorMsg = {
  type: "errors";
  errors: string[];
};

export type HmrMessage = HmrUpdateMsg | HmrErrorMsg;

export type BuilderResult =
  | {
      state: "success";
      output: Output;
      warnings: Diagnostic[];
    }
  | {
      state: "error";
      errors: Diagnostic[];
      warnings: Diagnostic[];
    }
  | {
      state: "interrupted";
    };

export type BuilderSetupResult =
  | {
      state: "success";
      warnings: Diagnostic[];
    }
  | {
      state: "error";
      errors: Diagnostic[];
      warnings: Diagnostic[];
    };

export type BuilderTeardownResult = BuilderSetupResult;

export type Output = {
  filesInfo: Info[];
  removedCount: number;
  time: number;
  timeCheckpoints?: Map<string, number>;
  hmrUpdate: HmrUpdate;
};

export type ProvidedPlugin<T> = Optional<
  string | T | readonly [string | T, any]
>;

export type ProvidedPluginsArr<T> = readonly ProvidedPlugin<T>[];

export type WarnCb = (msg: string) => void;
export type ErrorCb = (
  id: string,
  msg: string,
  code: string | null,
  loc: Loc | null
) => void;

export type Resolver = {
  name?: string;
  options?(options: any): MaybeAsync<any>;
  resolve(
    options: any,
    ctx: ResolveContext
  ): MaybeAsyncOptional<ResolvedDependency | false>;
};

export type Transformer = {
  name?: string;
  options?(options: any): MaybeAsync<any>;
  canReuseAST?: (options: any, ast: AstInfo) => boolean;
  parse?: (
    options: any,
    asset: MutableAsset,
    ctx: TransformContext
  ) => MaybeAsync<AstInfo>;
  transform?: (
    options: any,
    asset: MutableAsset,
    ctx: TransformContext
  ) => MaybeAsync<MutableAsset[]>;
  generate?: (
    options: any,
    asset: MutableAsset,
    ctx: TransformContext
  ) => MaybeAsync<GenerateOutput>;
};

export type Packager = {
  name?: string;
  options?(options: any): MaybeAsync<any>;
  pack(
    options: any,
    asset: FinalAsset,
    inlines: ReadonlyMap<FinalAsset, ToWrite>,
    hashIds: ReadonlyMap<string, string>,
    ctx: BuilderUtil
  ): MaybeAsyncOptional<ToWrite>;
};

export type Plugin<T> = {
  name: string;
  plugin: T;
  options: any;
};

export type OptimizationOptions = Readonly<{
  hashId: boolean;
  hashing: boolean;
  sourceMaps: boolean | "inline";
  minify: boolean;
  concatenateModules: boolean;
  treeshake: boolean;
}>;

export type UserConfigOpts = {
  cwd: string;
  optimization: OptimizationOptions;
  transformers: ProvidedPluginsArr<string>;
  packagers: ProvidedPluginsArr<string>;
};

export type WatchOptions = any;

export type Options = {
  extends: Optional<string | string[]>;
  cwd: string;
  mode: "production" | "development";
  entries: AssetRequest[];
  targets: Target[];
  dotGraph: Optional<string>;
  watch: boolean;
  watchOptions: WatchOptions;
  hmr: boolean;
  performance: PerformanceOpts;
  optimization: OptimizationOptions;
  serviceWorker: any;
  plugins: ProvidedPluginsArr<string>;
  transformers: ProvidedPluginsArr<string>;
  packagers: ProvidedPluginsArr<string>;
  _debug: boolean;
};
