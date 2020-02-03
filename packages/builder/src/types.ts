import { BuilderUtil, ModuleContext } from "./plugins/context";

export type Transforms = readonly (readonly string[])[];

export type Data = Buffer | string | Uint8Array;

export type DataType = "buffer" | "string" | "uint8array";

export type Loc = {
  line: number;
  column?: number;
};

export type AstInfo = {
  type: string;
  version: string;
  isDirty: boolean;
  program: any;
};

export type TransformableAsset = {
  type: string;
  data: Data;
  ast: AstInfo | null;
  map: any | null;
  depsInfo: DepsInfo | null;
  meta: { [key: string]: any } | null;
};

export type GenerateOutput = {
  data: Data;
  map: any;
};

export type ImportedName = {
  request: string;
  imported: string;
  name: string;
  loc?: Loc;
};

export type ExportedName = {
  request?: string;
  imported?: string;
  name: string;
  loc?: Loc;
};

export type Dep = {
  path?: string; // Possibly provide an already resolved dependency
  loc?: Loc;
  async?: boolean;
  transforms?: Transforms;
};

export type InnerDep = {
  type: string;
  data: Data;
  loc?: Loc;
  async?: boolean;
  transforms?: Transforms;
};

export type DepsInfo = {
  dependencies?: Map<string, Dep>;
  innerDependencies?: Map<string, InnerDep>;
  importedNames?: ImportedName[];
  exportedNames?: ExportedName[];
};

export type WatchedFileInfo = { time: number; onlyExistance?: boolean };
export type WatchedFiles = Map<string, WatchedFileInfo>;

export type Manifest = {
  files: string[];
  moduleToAssets: Map<string, string[]>;
};

export type RuntimeManifest = {
  f: string[];
  m: { [key: string]: number[] };
};

export type ResolvedDep = Readonly<{
  id: string;
  request: string;
  path: string;
  async: boolean;
  transforms: Transforms;
}>;

export type ResolvedInnerDep = Readonly<{
  id: string;
  innerId: string;
  type: string;
  async: boolean;
  transforms: Transforms;
}>;

export type FinalModule = Readonly<{
  id: string;
  path: string;
  relativePath: string;
  innerId: string | null;
  type: string;
  transformedId: number;
  asset: SharedArrayBuffer;
  resolvedId: number;
  dependencies: ReadonlyMap<string, ResolvedDep>;
  innerDependencies: ReadonlyMap<string, ResolvedInnerDep>;
  requires: readonly (ResolvedDep | ResolvedInnerDep)[];
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

export type ProcessedGraph = Readonly<{
  hashIds: ReadonlyMap<string, string>;
  moduleToFile: ReadonlyMap<FinalModule, FinalAsset>;
  files: readonly FinalAsset[];
  moduleToAssets: Readonly<{ [id: string]: string[] }>;
}>;

export type ToWrite = {
  data: Data;
  map?: any;
};

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

export type HmrUpdate = Readonly<{
  updates: Readonly<{
    id: string;
    file: string | null;
    prevFile: string | null;
    reloadApp: boolean;
  }>[];
  moduleToAssets: Readonly<{ [id: string]: string[] }>;
}>;

export type HmrMessage =
  | {
      type: "update";
      update: HmrUpdate;
    }
  | {
      type: "error";
      error: string;
    };

export type Output = {
  filesInfo: Info[];
  removedCount: number;
  time: number;
  timeCheckpoints?: Map<string, number>;
  hmrUpdate: HmrUpdate;
};

type MaybeAsync<T> = T | Promise<T>;
type MaybeAsyncOptional<T> = MaybeAsync<T | null | undefined>;

export type ProvidedPlugin<T> = void | string | T | [string | T, any];

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
    imported: string,
    ctx: ModuleContext
  ): MaybeAsyncOptional<
    string | false | { path: string; transforms?: Transforms }
  >;
};

export type Transformer = {
  name?: string;
  options?(options: any): MaybeAsync<any>;
  canReuseAST?: (options: any, ast: AstInfo) => boolean;
  parse?: (
    options: any,
    asset: TransformableAsset,
    ctx: ModuleContext
  ) => MaybeAsync<AstInfo>;
  transform?: (
    options: any,
    asset: TransformableAsset,
    ctx: ModuleContext
  ) => MaybeAsync<TransformableAsset>;
  generate?: (
    options: any,
    asset: TransformableAsset,
    ctx: ModuleContext
  ) => MaybeAsync<GenerateOutput>;
};

export type ICheckerImpl = {
  newModule(module: FinalModule): void;
  deletedModule(id: string): void;
  check(): MaybeAsync<void>;
};

export type Checker = {
  name?: string;
  options?(options: any): MaybeAsync<any>;
  checker(options: any, _: { warn: WarnCb; error: ErrorCb }): ICheckerImpl;
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

export type OptimizationOptions = {
  hashId: boolean;
  hashing: boolean;
  sourceMaps: boolean | "inline";
  minify: boolean;
  /* concatenateModules: boolean;
  treeshake: boolean; */
};

export type UserConfigOpts = {
  cwd: string;
  optimization: OptimizationOptions;
  resolvers: ProvidedPluginsArr<string>;
  transformers: ProvidedPluginsArr<string>;
  checkers: ProvidedPluginsArr<string>;
  packagers: ProvidedPluginsArr<string>;
};

export type Options = {
  mode: "production" | "development";
  context: string;
  entries: string[];
  dest: string;
  cwd: string;
  publicPath: string;
  dotGraph: string | null;
  runtime: {
    browser: boolean;
    node: boolean;
    worker: boolean;
  };
  codeFrameOptions: any;
  watch: boolean;
  watchOptions: any;
  hmr: boolean;
  performance: PerformanceOpts;
  optimization: OptimizationOptions;
  serviceWorker: any;
  reporter: ProvidedPlugin<Function>;
  resolvers: ProvidedPluginsArr<string>;
  transformers: ProvidedPluginsArr<string>;
  checkers: ProvidedPluginsArr<string>;
  packagers: ProvidedPluginsArr<string>;
  _debug: boolean;
};
