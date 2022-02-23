import {
  ValOrError,
  ResolvedDependency,
  DepRequestAndParent,
} from "../../types";
import {
  Computation,
  ComputationRunId,
} from "../../utils/computation-registry";
import { ResolveContext } from "../../plugins/context";
import { createDiagnostic } from "../../utils/error";
import { BuilderGraph } from "../builder-graph";
import { TransformComputation } from "./transform";

export class ResolveComputation extends Computation<
  BuilderGraph,
  ResolvedDependency
> {
  readonly request: DepRequestAndParent;
  private transformComp: TransformComputation | null;

  constructor(graph: BuilderGraph, request: DepRequestAndParent) {
    super(graph.computations);
    this.request = request;
    // Out edges
    this.transformComp = null;
  }

  destroy() {
    super.destroy();
    if (this.transformComp) {
      this.transformComp.decRef();
      this.transformComp = null;
    }
  }

  protected async run(
    _: ResolvedDependency | null,
    runId: ComputationRunId
  ): Promise<ValOrError<ResolvedDependency>> {
    const {
      graph: { builder },
      graph,
    } = this;
    const {
      dependency: { specifier, loc },
    } = this.request;

    if (!specifier) {
      return [
        null,
        createDiagnostic({
          category: "error",
          message: "No empty imports",
          loc,
        }),
      ];
    }

    const ctx = new ResolveContext(builder.options, this.request);
    const resolved = await builder.public.hooks.resolve.call(ctx);

    graph.subscribeFiles(ctx.getFiles(), file => this.getDep(file, runId));

    if (resolved.assetRequest) {
      const assetRequest = resolved.assetRequest;
      const newTransformComp = this.graph.addAssetRequest(assetRequest);

      if (this.transformComp !== newTransformComp) {
        if (this.transformComp) {
          this.transformComp.decRef();
        }
        this.transformComp = newTransformComp;
        this.transformComp.incRef();
      }
    }

    return [resolved, null];
  }
}
