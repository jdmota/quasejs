import path from "path";
import { ResolvedDependency } from "../types";
import { PublicBuilder } from "./builder";

export function install(builder: PublicBuilder) {
  builder.hooks.resolve.tap("quase builder default resolver", async ctx => {
    const { dependency, parent } = ctx.request;
    const importer = parent.request.path;
    const importee = dependency.specifier;

    const resolved = path.resolve(path.dirname(importer), importee);
    const isFile = await ctx.isFile(resolved);

    if (isFile) {
      const result: ResolvedDependency = {
        assetRequest: {
          env: dependency.env || parent.request.env,
          path: resolved,
          target: dependency.target || parent.request.target,
          transforms: dependency.transforms || parent.request.transforms,
        },
        external: false,
      };
      return result;
    }

    return false;
  });
}
