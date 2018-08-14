// @flow
import type Module from "./modules/index";
import type PublicModule from "./modules/public";
import type { ModuleUtils, ModuleUtilsWithFS } from "./modules/utils";
import type Builder from "./builder";
import type { Graph } from "./graph";

export type Data = Buffer | string;

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

export type ProvidedPluginsArr<T> = $ReadOnlyArray<void | string | T | [string | T, Object]>;

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

export type PublicModuleDep = {|
  +path: string,
  +request: string,
  +loc?: ?Loc,
  +async?: ?boolean,
  +splitPoint: boolean,
  +required: PublicModule,
  +inherit: boolean
|};

export type DepsInfo = {|
  +dependencies: Map<string, ?NotResolvedDep>,
  +innerDependencies: Map<string, InnerDep>,
  +importedNames: $ReadOnlyArray<ImportedName>,
  +exportedNames: $ReadOnlyArray<ExportedName>
|};

export type FinalAsset = {
  module: PublicModule,
  id: string,
  path: string,
  type: string,
  innerId: ?string,
  normalized: string,
  dest: string,
  relative: string,
  isEntry: boolean,
  srcs: PublicModule[],
  inlineAssets: FinalAsset[]
};

export type FinalAssets = {
  modules: Map<string, PublicModule>;
  files: FinalAsset[],
  moduleToAssets: Map<PublicModule, FinalAsset[]>
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

export type Loader = ( string, ModuleUtilsWithFS ) => ThingOrPromise<?Data>;

export type Parser = ( string, ModuleUtils ) => ThingOrPromise<?Object>;

export type AstTransformer = ( Object, ModuleUtilsWithFS ) => ThingOrPromise<?Object>;

export type BufferTransformer = ( Buffer, ModuleUtilsWithFS ) => ThingOrPromise<?Buffer>;

export type DepExtractor = ( Object, ModuleUtils ) => ThingOrPromise<?DepsInfo>;

export type Resolver = ( string, ModuleUtilsWithFS ) => ThingOrPromise<?string | false>;

export type Checker = ( Graph, Builder ) => ThingOrPromise<void>;

export type TypeTransformer = ( TransformOutput, ModuleUtilsWithFS ) => ThingOrPromise<?LoadOutput>;

export type GraphTransformer = ( FinalAssets ) => ThingOrPromise<?FinalAssets>;

export type AssetRenderer = ( FinalAsset, FinalAssets, Builder ) => ThingOrPromise<?ToWrite>;

export type AfterBuild = ( Output, Builder ) => ThingOrPromise<void>;

export type Plugin = {
  +name?: ?string,
  +getType?: ?( string ) => ?string,
  +load?: ?Loader,
  +parse?: ?{ [key: string]: ?Parser },
  +transformAst?: ?{ [key: string]: ?AstTransformer },
  +transformBuffer?: ?{ [key: string]: ?BufferTransformer },
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
  runtime: {
    browser: boolean,
    node: boolean,
    worker: boolean
  },
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
