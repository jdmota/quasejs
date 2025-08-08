import { createDiagnostic } from "../utils/error";
import {
  MutableAsset,
  GenerateOutput,
  FinalAsset,
  ToWrite,
  Transformer,
  Packager,
  Plugin,
  ImmutableAssets,
  ImmutableAsset,
} from "../types";
import { BuilderUtil, TransformContext } from "./context";
import { getType } from "../utils/path";
import { isObject, typeOf } from "../utils/index";
import { UserConfig } from "../builder/user-config";
import { PluginRegistry } from "./plugin-registry";

function validate(
  hook: string,
  expected: string,
  actual: unknown,
  name: string | null
) {
  throw createDiagnostic({
    category: "error",
    message: `'${hook}' expected ${expected}${
      actual ? ` but got ${typeOf(actual)}` : ""
    }${name ? ` on plugin ${name}` : ""}`,
  });
}

type GenerateFn = (asset: MutableAsset) => Promise<GenerateOutput>;
type TransformOutput = { results: MutableAsset[]; generate: GenerateFn };

export class PluginsRunner {
  config: UserConfig;
  transformers: PluginRegistry<Transformer>;
  packagers: PluginRegistry<Packager>;

  constructor(config: UserConfig) {
    this.config = config;
    this.transformers = new PluginRegistry();
    this.packagers = new PluginRegistry();
  }

  private async load(ctx: TransformContext) {
    try {
      return await ctx.readFile(ctx.request.path);
    } catch (err) {
      if (err.code === "ENOENT") {
        throw createDiagnostic({
          category: "error",
          message: `Could not find ${ctx.request.path}`,
        });
      }
      throw err;
    }
  }

  async transform(ctx: TransformContext): Promise<ImmutableAssets> {
    const assets = await this.transformHelper(
      {
        id: null,
        type: getType(ctx.request.path),
        data: await this.load(ctx),
        ast: null,
        map: null,
        dependencies: [],
        importedNames: [],
        exportedNames: [],
        meta: {},
        target: ctx.request.target,
        env: ctx.request.env ? [...ctx.request.env] : null,
        sideEffects: null,
        inline: null,
        isolated: null,
        splittable: null,
      },
      ctx
    );

    const usedIds = new Set<string>();
    const missingIds = new Map<string, number>();

    const assetsWithId: ImmutableAsset[] = [];

    for (const asset of assets) {
      let id = asset.id;

      if (id) {
        if (usedIds.has(id)) {
          throw createDiagnostic({
            category: "error",
            message: `Duplicate asset id ${JSON.stringify(id)}`,
          });
        } else {
          usedIds.add(id);
        }
      } else {
        const uuid = (missingIds.get(asset.type) || 0) + 1;
        id = `$/${asset.type}/${uuid}`;
        missingIds.set(asset.type, uuid);
        usedIds.add(id);
      }

      assetsWithId.push({
        ...asset,
        id,
      });
    }

    return assetsWithId;
  }

  private async transformHelper(
    initialAsset: MutableAsset,
    ctx: TransformContext
  ) {
    const initialType = initialAsset.type;
    const finalAssets = [];
    let pending1 = [initialAsset];
    let pending2 = [];

    while (pending1.length > 0) {
      for (const asset of pending1) {
        const results = await this.transformPipeline(asset, ctx);
        for (const a of results) {
          if (a.type === initialType) {
            finalAssets.push(a);
          } else {
            pending2.push(a);
          }
        }
      }

      pending1 = pending2;
      pending2 = [];
    }

    return finalAssets;
  }

  // Based on parcel-bundler
  private async transformPipeline(
    initialAsset: MutableAsset,
    ctx: TransformContext
  ) {
    const initialType = initialAsset.type;
    const finalAssets = [];
    let pending1 = [initialAsset];
    let pending2 = [];
    let previousGenerate: GenerateFn = () => {
      throw createDiagnostic({
        category: "error",
        message: `Assertion error: No generate method for initial asset`,
      });
    };

    for (const p of transformers) {
      for (const asset of pending1) {
        if (asset.type === initialType) {
          const { results, generate } = await this.runTransformer(
            asset,
            p,
            previousGenerate,
            ctx
          );
          previousGenerate = generate;
          for (const a of results) {
            pending2.push(a);
          }
        } else {
          finalAssets.push(asset);
        }
      }

      pending1 = pending2;
      pending2 = [];
    }

    for (const asset of pending1) {
      if (asset.ast) {
        const output = await previousGenerate(asset);
        asset.data = output.data;
        asset.map = output.map;
      }
      finalAssets.push(asset);
    }

    return finalAssets;
  }

  // Based on parcel-bundler
  private async runTransformer(
    asset: MutableAsset,
    { name, plugin, options }: Plugin<Transformer>,
    previousGenerate: GenerateFn,
    ctx: TransformContext
  ): Promise<TransformOutput> {
    if (!plugin.transform) {
      throw new Error(`Plugin ${name} does not have a transform function`);
    }

    // Reuse ast or generate code to re-parse
    if (
      asset.ast &&
      (!plugin.canReuseAST || !plugin.canReuseAST(options, asset.ast))
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

    const results = await plugin.transform(options, asset, ctx);

    // Create a generate function that can be called later
    const generate: GenerateFn = async (
      input: MutableAsset
    ): Promise<GenerateOutput> => {
      if (plugin.generate) {
        return plugin.generate(options, input, ctx);
      }

      throw createDiagnostic({
        category: "error",
        message: `Asset has an AST but no generate method is available on the transform`,
      });
    };

    return {
      results,
      generate,
    };
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
