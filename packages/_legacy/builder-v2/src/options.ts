import path from "path";
import Reporter from "./reporter";
import { Options } from "./types";
import { isAbsolute, resolvePath } from "./utils/path";

export const schema = `
type B @default(false) = boolean;
type B2 @default(true) = boolean;

type RuntimeOptions {
  browser: B2;
  node: B2;
  worker: B2;
}

type OptimizationOptions {
  hashId: boolean?;
  hashing: boolean?;
  sourceMaps: (boolean | "inline")?;
  minify: boolean?;
}

type PerformanceOptions {
  hints: "warning" | "error" @default("warning");
  maxEntrypointSize: number @default(250000);
  maxAssetSize: number @default(250000);
  assetFilter: Function @default(js(f => !/\\.map$/.test( f )));
}

type ServiceWorkerOptions @additionalProperties {
  filename: string?;
  staticFileGlobs: any[];
  stripPrefixMulti: type @additionalProperties {};
}

type Schema {
  mode: "production" | "development";
  context: string;
  entries: string[];
  dest: string;
  cwd: string @default(js(process.cwd()));
  publicPath: string @default("");
  dotGraph: string?;
  runtime: RuntimeOptions;
  codeFrameOptions: type @additionalProperties {};
  watch: B @alias("w") @description("Watch files for changes and re-build");
  watchOptions: type @additionalProperties {};
  hmr: B @description("Enable hot module replacement");
  performance: PerformanceOptions;
  optimization: OptimizationOptions;
  serviceWorker: ServiceWorkerOptions;
  plugins: any[] @mergeStrategy("concat");
  transformers: any[] @mergeStrategy("concat");
  packagers: any[] @mergeStrategy("concat");
  _debug: B;
}
`;

export function normalizeOptions(options: any) {
  if (!isAbsolute(options.cwd)) {
    throw new Error(`cwd option should be absolute`);
  }

  options.publicPath = options.publicPath
    ? options.publicPath.replace(/\/+$/, "") + "/"
    : "";

  if (!options.reporter) {
    options.reporter = Reporter;
  }

  function b(value: any) {
    return value == null ? options.mode !== "development" : value;
  }

  options.optimization = {
    hashId: b(options.optimization.hashId),
    hashing: b(options.optimization.hashing),
    sourceMaps:
      options.optimization.sourceMaps == null ||
      options.optimization.sourceMaps,
    minify: b(options.optimization.minify),
  };

  // TODO relax this?
  if (options.watch) {
    options.optimization.hashId = false;
  }

  // TODO
  let dest = "";

  options.serviceWorker.staticFileGlobs = options.serviceWorker.staticFileGlobs.map(
    (p: string) => path.join(dest, p)
  );
  options.serviceWorker.stripPrefixMulti[
    `${dest}${path.sep}`.replace(/\\/g, "/")
  ] = options.publicPath;
  options.serviceWorker.filename = options.serviceWorker.filename
    ? resolvePath(options.serviceWorker.filename, dest)
    : "";

  return {
    ...options,
  } as Options;
}
