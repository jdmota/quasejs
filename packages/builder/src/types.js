// @flow

import type FileSystem from "../../fs/memory-fs/src";
import type { ID } from "./id";
import type Builder from "./builder";

type Loc = { line: number, column?: ?number };

type NotResolvedDep = {
  src: string,
  loc?: ?Loc,
  splitPoint?: ?boolean,
  async?: ?boolean
};

type Resolver = ( NotResolvedDep, ID, Builder ) => Promise<string | ?false>;

type Checker = Builder => Promise<void>;

type ToWrite = {
  code: Buffer | string,
  map?: ?Object,
  usedHelpers?: ?Set<string>
};

type FinalAsset = {
  id: ID,
  normalizedId: string,
  dest: string,
  relativeDest: string,
  isEntry: boolean,
  srcs: ID[]
};

type FinalAssets = {
  files: FinalAsset[],
  moduleToAssets: Map<string, FinalAsset[]>
};

type Renderer = ( Builder, FinalAsset, FinalAssets, Set<string> ) => Promise<?ToWrite>;

type Dep = { resolved: ID } & NotResolvedDep;

type Deps = Dep[];

type Result = {
  buffer?: ?Buffer,
  code?: ?string,
  map?: ?Object,
  ast?: ?Object,
  deps?: ?Deps,
  type: string,
  [key: string]: any
};

type Transformer = ( Result, ID, Builder ) => Result | Promise<Result>;

type Plugin = {
  transform?: ?Transformer,
  resolve?: ?Resolver,
  check?: ?Checker,
  render?: ?Renderer
};

type PerformanceOpts = {
  hints: boolean | "warning" | "error",
  maxEntrypointSize: number,
  maxAssetSize: number,
  assetFilter: string => boolean
};

type MinimalFS = {
  writeFile( string, string | Buffer ): Promise<void>,
  mkdirp( string ): Promise<void>
};

type Options = {
  context: string,
  entries: string[],
  dest: string,
  cwd?: ?string,
  sourceMaps?: ?boolean | "inline",
  hashing?: ?boolean,
  defaultPlugins?: ?boolean,
  warn?: ?Function,
  fileSystem?: ?FileSystem,
  fs?: ?MinimalFS,
  cli?: ?Object,
  watch?: ?boolean,
  watchOptions?: ?Object,
  plugins?: ?Plugin[],
  performance?: ?PerformanceOpts,
  _hideDates?: ?boolean
};

export type {
  Result,
  Loc,
  NotResolvedDep,
  Dep,
  Deps,
  Plugin,
  Transformer,
  Resolver,
  Checker,
  Renderer,
  FinalAsset,
  FinalAssets,
  ToWrite,
  PerformanceOpts,
  MinimalFS,
  Options
};
