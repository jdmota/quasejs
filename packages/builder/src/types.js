// @flow
import type Builder from "./builder";
import type Module from "./module";
import type ModuleUtils from "./module-utils";

export type Data = Buffer | string;

export type DataType = "buffer" | "string";

export type Loc = {|
  +line: number,
  +column?: ?number
|};

export type TransformOutput = {|
  +data: Data,
  +map?: ?Object,
  +ast?: ?Object,
  +final?: ?boolean
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

export type ProvidedPluginsArr<T> = $ReadOnlyArray<void | string | T | [string | T, Object]>;

export type InnerModule = {|
  +index: number,
  +type: string,
  +data: Data,
  +map?: ?Object
|};

export type NotResolvedDep = {|
  +request: string,
  +inner?: ?InnerModule,
  +loc?: ?Loc,
  +async?: ?boolean
|};

export type Dep = {|
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
  +dependencies: $ReadOnlyArray<NotResolvedDep>,
  +importedNames: $ReadOnlyArray<ImportedName>,
  +exportedNames: $ReadOnlyArray<ExportedName>
|};

export type FinalAsset = {
  id: string,
  path: string,
  type: string,
  index: number,
  normalized: string,
  dest: string,
  relative: string,
  isEntry: boolean,
  srcs: string[]
};

export type FinalAssets = {
  files: FinalAsset[],
  moduleToAssets: Map<string, FinalAsset[]>
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

export type Info = { file: string, size: number, isEntry: boolean };

export type Output = {
  filesInfo: Info[],
  time: number
};

type ThingOrPromise<T> = T | Promise<T>;

export type Loader = ( string, ModuleUtils ) => ThingOrPromise<?Data>;

export type Transformer = ( TransformOutput, ModuleUtils ) => ThingOrPromise<?TransformOutput>;

export type DepExtractor = ( TransformOutput, ModuleUtils ) => ThingOrPromise<?DepsInfo>;

export type Resolver = ( string, ModuleUtils ) => ThingOrPromise<?string | false>;

export type Checker = Builder => ThingOrPromise<void>;

export type TypeTransformer = ( TransformOutput, ModuleUtils ) => ThingOrPromise<?TransformOutput>;

export type GraphTransformer = ( FinalAssets ) => ThingOrPromise<?FinalAssets>;

export type AssetRenderer = ( FinalAsset, FinalAssets, Builder ) => ThingOrPromise<?ToWrite>;

export type AfterBuild = ( Output, Builder ) => ThingOrPromise<void>;

export type Plugin = {
  +name?: ?string,
  +getType?: ?( string ) => ?string,
  +load?: ?Loader,
  +transform?: ?{ [key: string]: ?Transformer },
  +dependencies?: ?{ [key: string]: ?DepExtractor },
  +resolve?: ?{ [key: string]: ?Resolver },
  +isSplitPoint?: ?( ModuleUtils, ModuleUtils ) => ?boolean,
  +getTypeTransforms?: ?( ModuleUtils, ?ModuleUtils ) => ?$ReadOnlyArray<string>,
  +isExternal?: ?( string ) => ThingOrPromise<?boolean>,
  +transformType?: ?{ [key: string]: ?{ [key: string]: ?TypeTransformer } },
  +check?: ?Checker,
  +graphTransform?: ?GraphTransformer,
  +renderAsset?: ?{ [key: string]: ?AssetRenderer },
  +afterBuild?: ?AfterBuild
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
  warn: Function,
  fs: MinimalFS,
  cli: Object,
  reporter: ProvidedPluginsArr<Function>,
  watch: boolean,
  watchOptions: Object,
  plugins: ProvidedPluginsArr<Object => Plugin>,
  performance: PerformanceOpts,
  optimization: OptimizationOptions,
  serviceWorker: Object
};
