import { ResolvedDependency, Loc, Optional } from "../../types";
import { ResolveContext } from "../../plugins/context";
import { isAbsolute } from "../../utils/path";
import { isObject, typeOf } from "../../utils/index";
import {
  throwDiagnostic,
  createDiagnostic,
  createDiagnosticFromAny,
} from "../../utils/error";
import { AsyncSeriesBailHook } from "../hooks/builder-hooks";

function e(message: string, loc: Optional<Loc>) {
  return throwDiagnostic({
    category: "error",
    message,
    loc,
  });
}

export class ResolveHook extends AsyncSeriesBailHook<
  ResolveContext,
  ResolvedDependency | false,
  ResolvedDependency
> {
  validate(
    pluginName: string | undefined,
    ctx: ResolveContext,
    value: unknown
  ) {
    const {
      dependency: { specifier, loc },
      parent,
    } = ctx.request;

    if (isObject(value)) {
      const resolved = value as ResolvedDependency;
      const { assetRequest } = resolved;

      if (assetRequest) {
        const { path } = assetRequest;

        if (!isAbsolute(path)) {
          return e(`Resolution returned a non absolute path: ${path}`, loc);
        }

        if (path === parent.request.path) {
          return e(`A module cannot import itself`, loc);
        }

        if (ctx.isDest(path)) {
          return e(`Don't import files from the destination folder`, loc);
        }
      }

      return resolved;
    }
    if (value === false) {
      return e(
        `Could not resolve ${specifier} (from ${pluginName} plugin)`,
        loc
      );
    }
    if (value == null) {
      const count = this.pluginCount();
      if (count === 0) {
        return e(`No plugins for resolve hook exist`, loc);
      }
      return e(
        `All ${count} plugins for resolve hook returned null or undefined`,
        loc
      );
    }
    return e(
      `Plugin ${pluginName} on resolve hook, returned value of type ${typeOf(
        value
      )} but object or false was expected`,
      loc
    );
  }

  handleError(pluginName: string, ctx: ResolveContext, error: unknown) {
    return createDiagnostic({
      category: "error",
      message: `Plugin ${pluginName} on resolve hook thrown an error`,
      loc: ctx.request.dependency.loc,
      related: [createDiagnosticFromAny(error)],
    });
  }
}
