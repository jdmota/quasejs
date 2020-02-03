import { error } from "../utils/error";
import {
  TransformableAsset,
  GenerateOutput,
  FinalAsset,
  ToWrite,
  Transforms,
  Resolver,
  Transformer,
  Packager,
  Plugin,
} from "../types";
import { BuilderUtil, ModuleContext } from "./context";
import { getType } from "../utils/path";
import { UserConfig } from "../builder/user-config";
import { PluginRegistry } from "./plugin-registry";

function isObject(obj: unknown): boolean {
  return typeof obj === "object" && obj != null;
}

function typeOf(obj: unknown) {
  return obj === null ? "null" : typeof obj;
}

function validate(
  hook: string,
  expected: string,
  actual: unknown,
  name: string | null
) {
  error({
    message: `'${hook}' expected ${expected}${
      actual ? ` but got ${typeOf(actual)}` : ""
    }${name ? ` on plugin ${name}` : ""}`,
    noStack: true,
  });
}

type GenerateFn = (asset: TransformableAsset) => Promise<GenerateOutput>;
type TransformOutput = { result: TransformableAsset; generate: GenerateFn };

export class PluginsRunner {
  config: UserConfig;
  resolvers: PluginRegistry<Resolver>;
  transformers: PluginRegistry<Transformer>;
  packagers: PluginRegistry<Packager>;

  constructor(config: UserConfig) {
    this.config = config;
    this.resolvers = new PluginRegistry();
    this.transformers = new PluginRegistry();
    this.packagers = new PluginRegistry();
  }

  private async load(ctx: ModuleContext) {
    try {
      return await ctx.readFile(ctx.path);
    } catch (err) {
      if (err.code === "ENOENT") {
        throw error({
          message: `Could not find ${ctx.path}`,
          noStack: true,
        });
      }
      throw err;
    }
  }

  private async getTransformers(
    ctx: ModuleContext
  ): Promise<Plugin<Transformer>[]> {
    const transforms: Plugin<Transformer>[] = [];
    for (const t of ctx.transforms) {
      const p = this.transformers.get(t);
      if (!p) {
        throw new Error(`No plugin called ${t}`);
      }
      transforms.push(p);
    }
    return transforms;
  }

  async pipeline(
    asset: TransformableAsset | null,
    ctx: ModuleContext
  ): Promise<TransformableAsset> {
    const transformersJob = this.getTransformers(ctx);

    if (asset == null) {
      asset = {
        type: getType(ctx.path),
        data: await this.load(ctx),
        ast: null,
        map: null,
        depsInfo: null,
        meta: {},
      };
    }

    const transformers = await transformersJob;

    let previousGenerate: GenerateFn | null = null;

    for (const p of transformers) {
      const o: TransformOutput = await this.transform(
        asset,
        p,
        previousGenerate,
        ctx
      );
      asset = o.result;
      previousGenerate = o.generate;
    }

    /* if ( asset.ast && previousGenerate ) {
      const output = await previousGenerate( asset );
      asset.data = output.data;
      asset.map = output.map;
    } */

    return asset;
  }

  // Based on parcel-bundler
  private async transform(
    asset: TransformableAsset,
    { name, plugin, options }: Plugin<Transformer>,
    previousGenerate: GenerateFn | null,
    ctx: ModuleContext
  ): Promise<TransformOutput> {
    if (!plugin.transform) {
      throw new Error(`Plugin ${name} does not have a transform function`);
    }

    // Reuse ast or generate code to re-parse
    if (
      asset.ast &&
      (!plugin.canReuseAST || !plugin.canReuseAST(options, asset.ast)) &&
      previousGenerate
    ) {
      const output = await previousGenerate(asset);
      asset.data = output.data;
      asset.map = output.map;
      asset.ast = null;
    }

    // Parse if needed
    if (!asset.ast && plugin.parse) {
      asset.ast = await plugin.parse(options, asset, ctx);
    }

    const result = await plugin.transform(options, asset, ctx);

    // Create a generate function that can be called later
    const generate = async (
      input: TransformableAsset
    ): Promise<GenerateOutput> => {
      if (plugin.generate) {
        return plugin.generate(options, input, ctx);
      }

      throw error({
        message: `Asset has an AST but no generate method is available on the transform (${ctx.path})`,
        noStack: true,
      });
    };

    return {
      result,
      generate,
    };
  }

  private validateResolve(
    actual: any,
    name: string | null
  ): { path: string; transforms?: Transforms } | false {
    if (actual === false) {
      return actual;
    }
    if (typeof actual === "string") {
      return {
        path: actual,
      };
    }
    if (isObject(actual)) {
      return actual;
    }
    throw validate(
      "resolve",
      "string | false | { path: string, transforms: string[][] }",
      actual,
      name
    );
  }

  async resolve(
    imported: string,
    module: ModuleContext
  ): Promise<{ path: string; transforms?: Transforms } | false> {
    for (const { name, plugin, options } of this.resolvers.list()) {
      const fn = plugin.resolve;
      if (fn) {
        const result = await fn(options, imported, module);
        if (result != null) {
          return this.validateResolve(result, name);
        }
      }
    }
    return false;
  }

  private validateRenderAsset(actual: any, name: string | null): any {
    if (!isObject(actual)) {
      throw validate("renderAsset", "object", actual, name);
    }
    return {
      data: actual.data,
      map: this.config.optimization.sourceMaps ? actual.map : null,
    };
  }

  async renderAsset(
    asset: FinalAsset,
    hashIds: ReadonlyMap<string, string>,
    ctx: BuilderUtil
  ): Promise<ToWrite> {
    const inlines: Map<FinalAsset, ToWrite> = new Map();

    await Promise.all(
      asset.inlineAssets.map(async a => {
        const toWrite = await this.renderAsset(a, hashIds, ctx);
        inlines.set(a, toWrite);
      })
    );

    for (const { name, plugin, options } of this.packagers.list()) {
      const fn = plugin.pack;
      if (fn) {
        const result = await fn(options, asset, inlines, hashIds, ctx);
        if (result != null) {
          return this.validateRenderAsset(result, name);
        }
      }
    }

    if (asset.srcs.size !== 1) {
      throw new Error(
        `Asset "${asset.module.id}" has more than 1 source. Probably there is some plugin missing.`
      );
    }

    const { data, map } = ctx.deserializeAsset(asset.module.asset);

    if (data) {
      return {
        data,
        map: this.config.optimization.sourceMaps ? map : null,
      };
    }

    throw new Error(
      `Asset "${asset.module.id}" could not be rendered. Probably there is some plugin missing.`
    );
  }
}
