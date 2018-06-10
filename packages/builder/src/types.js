// @flow
import type Builder from "./builder";
import type Module from "./module";
import type Language from "./language";

export type Data = Buffer | string;

export type DataType = "buffer" | "string";

export type Loc = {
  +line: number,
  +column?: ?number
};

export type ImportedName = {
  +request: string,
  +imported: string,
  +name: string,
  +loc?: ?Loc
};

export type ExportedName = {
  +request?: ?string,
  +imported?: ?string,
  +name: string,
  +loc?: ?Loc
};

export type ProvidedPluginsArr<T> = $ReadOnlyArray<void | string | T | [string | T, Object]>;

export type NotResolvedDep = {
  request: string,
  loc?: ?Loc,
  async?: ?boolean
};

export type Dep = {
  path: string,
  request: string,
  loc?: ?Loc,
  async?: ?boolean
};

export type DepsInfo = {
  dependencies: NotResolvedDep[],
  importedNames: ImportedName[],
  exportedNames: ExportedName[]
};

export type FinalAsset = {
  id: string,
  path: string,
  normalized: string,
  dest: string,
  relativeDest: string,
  isEntry: boolean,
  srcs: string[]
};

export type FinalAssets = {
  files: FinalAsset[],
  moduleToAssets: Map<string, FinalAsset[]>
};

export type ToWrite = {
  data: Data,
  map?: ?Object
};

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
  filesInfo: Info[]
};

export type LoaderOutput = {
  +type: string,
  +data: Data,
  +map: ?Object,
  +ast: ?Object
};

export type Loader = ( LoaderOutput, Object, Module, Builder ) => ?Promise<LoaderOutput>;

export type Checker = Builder => ?Promise<void>;

export type GraphTransformer = ( FinalAssets, Builder ) => ?Promise<?FinalAssets>;

export type AfterBuild = ( Output, Builder ) => ?Promise<void>;

export type Plugin = {
  +name?: ?string,
  +load?: ?( string, Builder ) => ?Promise<?LoaderOutput>,
  +transform?: ?( LoaderOutput, Module, Builder ) => ?Promise<?LoaderOutput>,
  +getLanguage?: ?( Module, Builder ) => ?Promise<?Language>,
  +resolve?: ?( string, Module, Builder ) => ?Promise<?string | false>,
  +isSplitPoint?: ?( Module, Module, Builder ) => ?Promise<?boolean>,
  +isExternal?: ?( string, Builder ) => ?Promise<?boolean>,
  +checker?: ?Checker,
  +graphTransformer?: ?GraphTransformer,
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
