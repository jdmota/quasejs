import fs from "fs-extra";
import path from "path";

export type RuntimeOptions = Readonly<{
  hmr: Readonly<{
    hostname: string;
    port: number;
  }> | null;
  browser: boolean;
  node: boolean;
  worker: boolean;
}>;

export type RuntimeInfo = Readonly<{
  context: string;
  fullPath: string;
  publicPath: string;
  minify: boolean;
  buildKey: string | null;
}>;

const DEFAULT_KEY = "__quase_builder__";

export const moduleArgs: readonly string[] = "$e,$r,$i,$g,$a,$m".split(",");

const cache: { [key: string]: Promise<string> } = {};

export async function createRuntime(
  runtimeOpts: RuntimeOptions,
  { context, fullPath, publicPath, minify, buildKey }: RuntimeInfo
) {
  const minified = minify === undefined ? !runtimeOpts.hmr : !!minify;

  const filename = [
    "runtime",
    runtimeOpts.browser && "browser",
    runtimeOpts.hmr && "hmr",
    minified && "min",
    "js",
  ]
    .filter(Boolean)
    .join(".");

  const fullFilename = path.join(__dirname, "builds", filename);

  let runtime = await (cache[filename] ||
    (cache[filename] = fs.readFile(fullFilename, "utf8")));

  if (runtimeOpts.node) {
    const relative =
      (path.relative(path.dirname(fullPath), context).replace(/\\/g, "/") ||
        ".") + "/";

    if (relative === publicPath) {
      runtime = runtime.replace("$_PUBLIC_PATH", JSON.stringify(publicPath));
    } else {
      runtime = runtime.replace(
        "$_PUBLIC_PATH",
        `nodeRequire ? ${JSON.stringify(relative)} : ${JSON.stringify(
          publicPath
        )}`
      );
    }
  } else {
    runtime = runtime.replace("$_PUBLIC_PATH", JSON.stringify(publicPath));
  }

  runtime = runtime.replace(
    "$_HMR",
    JSON.stringify(
      runtimeOpts.hmr
        ? { hostname: runtimeOpts.hmr.hostname, port: runtimeOpts.hmr.port }
        : null
    )
  );

  const buildKeyString = JSON.stringify(buildKey || DEFAULT_KEY);

  runtime = runtime.replace("$_BUILD_KEY", buildKeyString);

  return {
    runtime,
    init: `"use strict";({g:"undefined"==typeof self?Function("return this")():self,k:${buildKeyString},p(m,f){(this.g[this.k]=this.g[this.k]||{q:[]}).q.push([m,f])}})`,
  };
}
