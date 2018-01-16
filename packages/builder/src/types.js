// @flow
import type Builder from "./builder";
import type Module from "./module";

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

export type ProvidedPluginsArr = $ReadOnlyArray<void | string | Function | [string | Function, Object]>;

// $FlowFixMe
export type QueryArr = $ReadOnlyArray<string | [string, Object]>;

export type Query = {
  +str: string,
  +arr: QueryArr,
  +default?: ?boolean,
};

export type NotResolvedDep = {
  request: string,
  loc?: ?Loc,
  async?: ?boolean
};

export type Dep = {
  path: string,
  query: Query,
  request: string,
  loc?: ?Loc,
  async?: ?boolean
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
  map?: ?Object,
  usedHelpers?: ?Set<string>
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

export type Output = {
  filesInfo: {
    file: string,
    size: number,
    isEntry: boolean
  }[]
};

export type Checker = ( Builder, Object ) => ?Promise<void>;

export type GraphTransformer = ( FinalAssets, Builder, Object ) => ?Promise<?FinalAssets>;

export type AfterBuild = ( Output, Object ) => ?Promise<void>;

export type Options = {
  context: string,
  entries: string[],
  dest: string,
  cwd?: ?string,
  sourceMaps?: ?boolean | "inline",
  hashing?: ?boolean,
  publicPath?: ?string,
  buildDefaultQuery?: ?( string ) => ?QueryArr;
  warn?: ?Function,
  fs?: ?MinimalFS,
  cli?: ?Object,
  reporter?: ?string | Function,
  watch?: ?boolean,
  watchOptions?: ?Object,
  languages?: ?ProvidedPluginsArr,
  isSplitPoint?: ?( Module, Module ) => ?boolean,
  loaderAlias?: ?{ [key: string]: Function },
  checkers?: ( Checker | [ Checker, Object ] )[];
  graphTransformers?: ( GraphTransformer | [ GraphTransformer, Object ] )[];
  afterBuild?: ( AfterBuild | [ AfterBuild, Object ] )[];
  performance?: ?PerformanceOpts,
  serviceWorker?: ?Object,
  cleanBeforeBuild?: ?boolean,
  _hideDates?: ?boolean
};
