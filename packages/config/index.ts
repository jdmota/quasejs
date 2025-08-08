import { readFile } from "node:fs/promises";
import { type FindUpOptions, findUpCustom, isFile } from "../util/fs";
import {
  arrify,
  type MaybeAsync,
  type Optional,
  type ReadonlyArrayable,
} from "../util/miscellaneous";

// Inspired in https://github.com/antfu-collective/unconfig

export const defaultExtensions = [
  "mts",
  "cts",
  "ts",
  "mjs",
  "cjs",
  "js",
  "json",
  "",
] as const;

// Nullish means to skip
export type ConfigLoader<T> = (
  ctx: LoadConfigCtx<T>
) => MaybeAsync<Optional<T>>;

// Nullish means to skip
export type ConfigRewriter<T> = (
  ctx: LoadConfigResultOK<T>
) => MaybeAsync<Optional<T>>;

export type LoadConfigSource<T> = Readonly<{
  files: ReadonlyArrayable<string>;
  extensions?: string[];
  load?: ConfigLoader<T>;
  rewrite?: ConfigRewriter<T>;
}>;

export type LoadConfigOptions<T> = Readonly<{
  sources: ReadonlyArrayable<LoadConfigSource<T>>;
  findUpOpts?: FindUpOptions;
}>;

export type LoadConfigCtx<T> = Readonly<{
  source: LoadConfigSource<T>;
  filename: string;
}>;

export type LoadConfigResultOK<T> = Readonly<{
  source: LoadConfigSource<T>;
  filename: string;
  config: T;
}>;

export type LoadConfigResult<T> =
  | Readonly<{
      ok: true;
      source: LoadConfigSource<T>;
      filename: string;
      config: T;
    }>
  | Readonly<{
      ok: false;
      source: LoadConfigSource<T>;
      filename: string;
      error: unknown;
    }>;

export type LoadConfigResults<T> = readonly LoadConfigResult<T>[];

export const defaultLoader: ConfigLoader<any> = async ctx => {
  if (ctx.filename.endsWith(".json")) {
    return JSON.parse(await readFile(ctx.filename, "utf8"));
  }

  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.filename, {
    fsCache: false,
    moduleCache: false,
    interopDefault: true,
  });
  const config = await jiti.import(ctx.filename, {
    default: true,
  });
  return config;
};

export const defaultRewriter: ConfigRewriter<any> = ctx => {
  return ctx.config;
};

export async function getConfig<T>(
  opts: LoadConfigOptions<T>
): Promise<LoadConfigResults<T>> {
  const sources = arrify(opts.sources);
  const findUpOpts = opts.findUpOpts ?? {};
  const results: LoadConfigResult<T>[] = [];

  for (const source of sources) {
    results.push(...(await getConfigBySource(source, findUpOpts)));
  }

  return results;
}

export async function getConfigBySource<T>(
  source: LoadConfigSource<T>,
  findUpOpts: FindUpOptions
): Promise<LoadConfigResults<T>> {
  const loader: ConfigLoader<T> = source.load ?? defaultLoader;
  const rewriter: ConfigRewriter<T> = source.rewrite ?? defaultRewriter;
  const allowSymlinks = findUpOpts.allowSymlinks ?? true;

  const { files, extensions = defaultExtensions } = source;
  const targets = arrify(files).flatMap(file =>
    extensions.length > 0
      ? extensions.map(ext => (ext ? `${file}.${ext}` : file))
      : [file]
  );

  return findUpCustom<LoadConfigResult<T>>(
    targets,
    findUpOpts,
    async filename => {
      const exists = await isFile(filename, allowSymlinks);
      if (!exists) {
        return;
      }

      try {
        const loadResult = await loader({
          source,
          filename,
        });

        if (loadResult != null) {
          const rewriteResult = await rewriter({
            source,
            filename,
            config: loadResult,
          });

          if (rewriteResult != null) {
            return {
              ok: true,
              source,
              filename,
              config: rewriteResult,
            };
          }
        }
      } catch (error) {
        return {
          ok: false,
          source,
          filename,
          error,
        };
      }
    }
  );
}
