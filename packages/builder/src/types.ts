import Module from "./module";
import { BuilderContext, ModuleContext } from "./plugins/context";
import { Graph } from "./graph";

export type Data = Buffer | string | Uint8Array;

export type DataType = "buffer" | "string";

export type Loc = {
  line: number;
  column?: number;
};

export type LoadOutput = {
  data: Data;
  map: any|null;
};

export type TransformOutput = {
  ast: any;
  buffer: Buffer | Uint8Array | null;
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

export type ProvidedPlugin<T> = void | string | T | [string | T, any];

export type ProvidedPluginsArr<T> = ReadonlyArray<ProvidedPlugin<T>>;

export type NotResolvedDep = {
  loc?: Loc;
  async?: boolean;
  typeTransforms?: ReadonlyArray<string>;
};

export type InnerDep = {
  type: string;
  data: Data;
  loc?: Loc;
  async?: boolean;
};

export type ResolvedDep = {
  path: string;
  request: string;
  loc?: Loc;
  async?: boolean;
};

export type ModuleDep = {
  path: string;
  request: string;
  loc?: Loc;
  async?: boolean;
  splitPoint: boolean;
  required: Module;
  inherit: boolean;
};

export type DepsInfo = {
  dependencies: Map<string, NotResolvedDep|null>;
  innerDependencies: Map<string, InnerDep>;
  importedNames: ReadonlyArray<ImportedName>;
  exportedNames: ReadonlyArray<ExportedName>;
};

export type WatchedFileInfo = { time: number; onlyExistance?: boolean };
export type WatchedFiles = Map<string, WatchedFileInfo>;

export type PipelineResult = {
  depsInfo: DepsInfo;
  content: TransformOutput;
};

export type Manifest = {
  files: FinalAsset[];
  moduleToAssets: Map<Module, FinalAsset[]>;
};

export type FinalAsset = {
  module: Module;
  id: string;
  path: string;
  type: string;
  innerId: string|null;
  normalized: string;
  relativePath: string;
  relativeDest: string;
  hash: string | null;
  isEntry: boolean;
  runtime: {
    code: string|null;
    manifest: {
      f: string[];
      m: { [key: string]: number[] };
    }|null;
  };
  manifest: Manifest;
  srcs: Set<Module>;
  inlineAssets: FinalAsset[];
};

export type ProcessedGraph = {
  moduleToFile: Map<Module, FinalAsset>;
  files: FinalAsset[];
};

export type ToWrite = {
  data: Data;
  map?: any;
};

export type PerformanceOpts = {
  hints: boolean | "warning" | "error";
  maxEntrypointSize: number;
  maxAssetSize: number;
  assetFilter: ( asset: string ) => boolean;
};

export type MinimalFS = {
  writeFile( file: string, data: Data ): Promise<void>;
  mkdirp( file: string ): Promise<void>;
};

export type Info = {
  file: string;
  hash: string | null;
  size: number;
  isEntry: boolean;
};

export type Updates = {
  id: string;
  file: string|null;
  prevFile: string|null;
  reloadApp: boolean;
  requiredAssets: string[];
}[];

export type Output = {
  filesInfo: Info[];
  time: number;
  updates: Updates;
};

type ThingOrPromise<T> = T | Promise<T>;

export type Loader = ( file: string, ctx: ModuleContext ) => ThingOrPromise<Data|null>;

export type Parser = ( code: string, ctx: ModuleContext ) => ThingOrPromise<any|null>;

export type AstTransformer = ( ast: any, ctx: ModuleContext ) => ThingOrPromise<any|null>;

export type BufferTransformer =
  ( data: Buffer | Uint8Array, ctx: ModuleContext ) => ThingOrPromise<Buffer | Uint8Array | null>;

export type DepExtractor = ( ast: any, ctx: ModuleContext ) => ThingOrPromise<DepsInfo | null>;

export type Resolver = ( request: string, importer: ModuleContext ) => ThingOrPromise<string | false | null>;

export type Checker = ( graph: Graph ) => ThingOrPromise<void>;

export type TypeTransformer =
  ( prevOutput: TransformOutput, ctx: ModuleContext ) => ThingOrPromise<LoadOutput | null>;

export type GraphTransformer = ( graph: ProcessedGraph ) => ThingOrPromise<ProcessedGraph | null>;

export type AssetRenderer =
  (
    asset: FinalAsset, inlineAssets: Map<FinalAsset, ToWrite>, ctx: BuilderContext
  ) => ThingOrPromise<ToWrite | null>;

export type Plugin = {
  name?: string;
  getType?: ( file: string ) => string | null;
  load?: Loader;
  parse?: { [key: string]: Parser };
  transformAst?: { [key: string]: AstTransformer };
  transformBuffer?: { [key: string]: BufferTransformer };
  dependencies?: { [key: string]: DepExtractor };
  resolve?: { [key: string]: Resolver };
  isSplitPoint?:
    ( imported: ModuleContext, importer: ModuleContext ) => boolean | null;
  getTypeTransforms?:
    ( imported: ModuleContext, importer: ModuleContext | null ) => ReadonlyArray<string> | null;
  isExternal?: ( file: string ) => ThingOrPromise<boolean | null>;
  transformType?: { [key: string]: { [key: string]: TypeTransformer } };
  check?: Checker;
  graphTransform?: GraphTransformer;
  renderAsset?: { [key: string]: AssetRenderer };
};

export type OptimizationOptions = {
  hashId: boolean;
  hashing: boolean;
  sourceMaps: boolean | "inline";
  minify: boolean;
  /* concatenateModules: boolean;
  treeshake: boolean; */
  cleanup: boolean;
};

export type Options = {
  mode: "production" | "development";
  context: string;
  entries: string[];
  dest: string;
  cwd: string;
  publicPath: string;
  dotGraph: string|null;
  runtime: {
    browser: boolean;
    node: boolean;
    worker: boolean;
  };
  fs: MinimalFS;
  reporter: ProvidedPlugin<Function>;
  codeFrameOptions: any;
  watch: boolean;
  watchOptions: any;
  hmr: boolean;
  plugins: ProvidedPluginsArr<string>;
  performance: PerformanceOpts;
  optimization: OptimizationOptions;
  serviceWorker: any;
};
