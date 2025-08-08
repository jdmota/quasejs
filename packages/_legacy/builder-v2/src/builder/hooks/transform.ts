import { ImmutableAssets } from "../../types";
import { TransformContext } from "../../plugins/context";
import { AsyncSeriesBailHook } from "../hooks/builder-hooks";
import {
  throwDiagnostic,
  createDiagnostic,
  createDiagnosticFromAny,
} from "../../utils/error";
import { typeOf } from "../../utils";

export class TransformHook extends AsyncSeriesBailHook<
  TransformContext,
  ImmutableAssets
> {
  validate(
    pluginName: string | undefined,
    ctx: TransformContext,
    value: unknown
  ) {
    if (Array.isArray(value)) {
      return value as ImmutableAssets;
    }
    if (value == null) {
      const count = this.pluginCount();
      if (count === 0) {
        return throwDiagnostic({
          category: "error",
          message: `No plugins for transform hook exist`,
        });
      }
      return throwDiagnostic({
        category: "error",
        message: `All ${count} plugins for transform hook returned null or undefined`,
      });
    }
    return throwDiagnostic({
      category: "error",
      message: `Plugin ${pluginName} on transform hook, returned value of type ${typeOf(
        value
      )} but an array of assets was expected`,
      related: [
        createDiagnostic({
          category: "info",
          message: `While transforming ${ctx.request.path}`,
        }),
      ],
    });
  }

  handleError(pluginName: string, ctx: TransformContext, error: unknown) {
    return createDiagnostic({
      category: "error",
      message: `Plugin ${pluginName} on transform hook thrown an error`,
      related: [
        createDiagnostic({
          category: "info",
          message: `While transforming ${ctx.request.path}`,
        }),
        createDiagnosticFromAny(error),
      ],
    });
  }
}
