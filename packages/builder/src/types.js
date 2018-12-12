// @flow
import type Module from "./module";
import type { BuilderContext, ModuleContext } from "./plugins/context";
import type { Graph } from "./graph";

export type Data = Buffer | string | Uint8Array;

export type DataType = "buffer" | "string";

export type Loc = {|
  +line: number,
  +column?: ?number
|};

export type LoadOutput = {|
  +data: Data,
  +map: ?Object
|};

export type TransformOutput = {|
  +ast: Object,
  +buffer: ?void
|} | {|
  +ast: ?void,
  +buffer: Buffer
|};

export type ImportedName = {|
  +request: string,
  +imported: string,
  +name: string,
  +loc?: ?Loc
|};

export type ExportedName = {|
  +request?: ?string,
  +imported?: ?string,
  +name: string,
  +loc?: ?Loc
|};

export type ProvidedPlugin<T> = void | string | T | [string | T, Object];

export type ProvidedPluginsArr<T> = $ReadOnlyArray<ProvidedPlugin<T>>;

export type NotResolvedDep = {
  +loc?: ?Loc,
  +async?: ?boolean
};

export type InnerDep = {
  +type: string,
  +data: Data,
  +loc?: ?Loc,
  +async?: ?boolean
};

export type ResolvedDep = {|
  +path: string,
  +request: string,
  +loc?: ?Loc,
  +async?: ?boolean
|};

export type ModuleDep = {|
  +path: string,
  +request: string,
  +loc?: ?Loc,
  +async?: ?boolean,
  +splitPoint: boolean,
  +required: Module,
  +inherit: boolean
|};

export type DepsInfo = {|
  +dependencies: Map<string, ?NotResolvedDep>,
  +innerDependencies: Map<string, InnerDep>,
  +importedNames: $ReadOnlyArray<ImportedName>,
  +exportedNames: $ReadOnlyArray<ExportedName>
|};

export type WatchedFileInfo = { +time: number, onlyExistance: ?boolean };
export type WatchedFiles = Map<string, WatchedFileInfo>;

export type PipelineResult = {
  +depsInfo: DepsInfo,
  +content: TransformOutput
};

export type FinalAsset = {
  module: Module,
  id: string,
  path: string,
  type: string,
  innerId: ?string,
  normalized: string,
  relativePath: string,
  relativeDest: string,
  hash: string | null,
  isEntry: boolean,
  runtime: ?{
    relativeDest: string,
    code: string
  },
  srcs: Module[],
  inlineAssets: FinalAsset[]
};

export type FinalAssets = {
  modules: Map<string, Module>;
  files: FinalAsset[],
  moduleToAssets: Map<Module, FinalAsset[]>
};

export type ToWrite = {|
  +data: Data,
  +map?: ?Object
|};

export type PerformanceOpts = {
  hints: boolean | "warning" | "error",
  maxEntrypointSize: number,
  maxAssetSize: number,
  assetFilter: string => boolean
};

export type MinimalFS = {
  writeFile( string, Data ): Promise<void>,
  mkdirp( string ): Promise<void>
};

export type Info = {
  file: string,
  hash: string | null,
  size: number,
  isEntry: boolean
};

export type Output = {
  filesInfo: Info[],
  time: number,
  update: ?{
    manifest: {
      files: string[],
      moduleToFiles: { [key: string]: number[] },
    },
    ids: string[],
    files: string[],
    reloadApp: boolean
  }
};

type ThingOrPromise<T> = T | Promise<T>;

export type Loader = ( string, ModuleContext ) => ThingOrPromise<?Data>;

export type Parser = ( string, ModuleContext ) => ThingOrPromise<?Object>;

export type AstTransformer = ( Object, ModuleContext ) => ThingOrPromise<?Object>;

export type BufferTransformer = ( Buffer, ModuleContext ) => ThingOrPromise<?Buffer>;

export type DepExtractor = ( Object, ModuleContext ) => ThingOrPromise<?DepsInfo>;

export type Resolver = ( string, ModuleContext ) => ThingOrPromise<?string | false>;

export type Checker = Graph => ThingOrPromise<void>;

export type TypeTransformer = ( TransformOutput, ModuleContext ) => ThingOrPromise<?LoadOutput>;

export type GraphTransformer = ( FinalAssets ) => ThingOrPromise<?FinalAssets>;

export type AssetRenderer = ( FinalAsset, FinalAssets, Map<FinalAsset, ToWrite>, BuilderContext ) => ThingOrPromise<?ToWrite>;

export type Plugin = {
  +name?: ?string,
  +getType?: ?( string ) => ?string,
  +load?: ?Loader,
  +parse?: ?{ [key: string]: ?Parser },
  +transformAst?: ?{ [key: string]: ?AstTransformer },
  +transformBuffer?: ?{ [key: string]: ?BufferTransformer },
  +dependencies?: ?{ [key: string]: ?DepExtractor },
  +resolve?: ?{ [key: string]: ?Resolver },
  +isSplitPoint?: ?( ModuleContext, ModuleContext ) => ?boolean,
  +getTypeTransforms?: ?( ModuleContext, ?ModuleContext ) => ?$ReadOnlyArray<string>,
  +isExternal?: ?( string ) => ThingOrPromise<?boolean>,
  +transformType?: ?{ [key: string]: ?{ [key: string]: ?TypeTransformer } },
  +check?: ?Checker,
  +graphTransform?: ?GraphTransformer,
  +renderAsset?: ?{ [key: string]: ?AssetRenderer }
};

export type OptimizationOptions = {
  hashId: boolean,
  hashing: boolean,
  sourceMaps: boolean | "inline",
  minify: boolean,
  /* concatenateModules: boolean,
  treeShaking: boolean, */
  cleanup: boolean
};

export type Options = {
  mode: "production" | "development",
  context: string,
  entries: string[],
  dest: string,
  cwd: string,
  publicPath: string,
  runtime: {
    browser: boolean,
    node: boolean,
    worker: boolean
  },
  fs: MinimalFS,
  reporter: ProvidedPlugin<Function>,
  codeFrameOptions: Object,
  watch: boolean,
  watchOptions: Object,
  hmr: boolean,
  plugins: ProvidedPluginsArr<string>,
  performance: PerformanceOpts,
  optimization: OptimizationOptions,
  serviceWorker: Object
};
