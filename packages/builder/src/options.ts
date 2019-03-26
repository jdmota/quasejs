import Reporter from "./reporter";

const fs = require( "fs-extra" );

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
  cleanup: boolean?;
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
  fs: type @additionalProperties {};
  codeFrameOptions: type @additionalProperties {};
  reporter: ( string | Function | [ string | Function, Object ] )?;
  watch: B @alias("w") @description("Watch files for changes and re-build");
  watchOptions: type @additionalProperties {};
  hmr: B @description("Enable hot module replacement");
  plugins: any[] @mergeStrategy("concat");
  performance: PerformanceOptions;
  optimization: OptimizationOptions;
  serviceWorker: ServiceWorkerOptions;
}
`;

export function handleOptions( options: any ) {
  if ( !options.reporter ) {
    options.reporter = Reporter;
  }
  options.fs = {
    ...options.fs
  };
  if ( !options.fs.writeFile ) {
    options.fs.writeFile = fs.writeFile;
  }
  if ( !options.fs.mkdirp ) {
    options.fs.mkdirp = fs.mkdirp;
  }

  function b( value ) {
    return value == null ? options.mode !== "development" : value;
  }

  options.optimization = {
    hashId: b( options.optimization.hashId ),
    hashing: b( options.optimization.hashing ),
    sourceMaps: options.optimization.sourceMaps == null || options.optimization.sourceMaps,
    minify: b( options.optimization.minify ),
    cleanup: b( options.optimization.cleanup )
  };

  return options;
}
