// @flow

import type FileSystem from "../../fs/src/file-system";
import type { ID } from "./id";
import type Builder from "./builder";

type Resolver = ( { src: string, loc: ?Object, splitPoint: ?boolean }, ID, Builder ) => Promise<string | ?false>;

type Checker = Builder => Promise<void>;

type ToWrite = { dest: string, code: Buffer | string, map: ?Object };

type FinalModules = {
  modules: ( { id: ID, srcs: ID[], entrypoint: boolean, dest: string, built: boolean } )[],
  moduleToFile: { [name: ID]: ID }
};

type Renderer = ( Builder, FinalModules ) => Promise<ToWrite[]>;

type Deps = {
  resolved: ID,
  src: string,
  loc?: ?{ line: number, column?: ?number },
  splitPoint?: ?boolean
}[];

type Result = {
  buffer?: ?Buffer,
  code?: ?string,
  map?: ?Object,
  ast?: ?Object,
  deps?: ?Deps,
  type: string,
  [key: string]: any
};

type Plugin = ( Result, ID, Builder ) => any | Promise<any>;

type PerformanceOpts = {
  hints: false | "warning" | "error",
  maxEntrypointSize: number,
  maxAssetSize: number,
  assetFilter: string => boolean
};

type Options = {
  context: string,
  entries: string[],
  dest: string,
  cwd?: ?string,
  sourceMaps?: ?boolean | "inline",
  hashing?: ?boolean,
  warn?: ?Function,
  fileSystem?: ?FileSystem,
  fs?: ?{
    writeFile: Function,
    mkdirp: Function
  },
  cli?: ?Object,
  watch?: ?boolean,
  watchOptions?: ?Object,
  plugins?: ?Plugin[],
  resolvers?: ?Resolver[],
  checkers?: ?Checker[],
  renderers?: ?Renderer[],
  performance?: ?PerformanceOpts,
  uuid?: ?number,
  _hideDates?: ?boolean
};

export type { Result, Deps, Plugin, Resolver, Checker, Renderer, FinalModules, ToWrite, PerformanceOpts, Options };
