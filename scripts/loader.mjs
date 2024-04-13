// https://nodejs.org/docs/latest-v21.x/api/module.html#hooks
import { readFile } from "node:fs/promises";
import { resolve as pnpResolve, load as pnpLoad } from "../.pnp.loader.mjs";

const babelOptions = {
  presets: ["@babel/preset-typescript"],
  // Don't look for configs
  configFile: false,
  babelrc: false,
  // Ignore any node_modules (not just those in current working directory)
  // https://github.com/babel/babel/blob/master/packages/babel-register/src/node.js#L146
  ignore: [/node_modules/],
};

const extensionsRegex = /\.ts$/;

export async function resolve(specifier, context, nextResolve) {
  try {
    return await pnpResolve(specifier, context, nextResolve);
  } catch (err) {
    return await pnpResolve(specifier + ".ts", context, nextResolve);
  }
}

export async function load(url, context, nextLoad) {
  if (extensionsRegex.test(url)) {
    const rawSource = await readFile(new URL(url), "utf-8");
    const { default: babel } = await import("@babel/core");

    const transformedSource = (
      await babel.transformAsync(rawSource, {
        sourceType: "module",
        filename: url,
        ...babelOptions,
      })
    ).code;

    return {
      format: "module",
      shortCircuit: true,
      source: transformedSource,
    };
  }
  return pnpLoad(url, context, nextLoad);
}
