import {
  ValOrError,
  AssetRequest,
  Processed,
  DepRequestAndParent,
  serializerDepRequestAndParent,
} from "../../types";
import {
  Computation,
  ComputationRunId,
} from "../../utils/computation-registry";
import { TransformContext } from "../../plugins/context";
import { BuilderGraph } from "../builder-graph";
import { DefaultMap } from "../../utils/default-map";
import { ResolveComputation } from "./resolve";
import { Diagnostic } from "../../utils/error";

export class TransformComputation extends Computation<BuilderGraph, Processed> {
  readonly request: AssetRequest;
  private id: number;
  private resolutions: DefaultMap<
    string,
    DepRequestAndParent,
    ResolveComputation
  >;
  private refs: number;
  private lastEvent: Promise<Diagnostic | void> | undefined;

  constructor(graph: BuilderGraph, request: AssetRequest) {
    super(graph.computations);
    this.request = request;
    this.id = 0;
    this.lastEvent = undefined;
    // In edges
    this.refs = 0;
    // Out edges
    this.resolutions = new DefaultMap(depRequest =>
      graph.addNode(new ResolveComputation(graph, depRequest))
    );
  }

  destroy() {
    super.destroy();

    for (const resolveComp of this.resolutions.values()) {
      this.graph.removeNode(resolveComp);
    }

    this.resolutions.clear();
  }

  incRef() {
    this.refs++;
    this.onInEdgeAddition();
  }

  decRef() {
    this.refs--;
    this.onInEdgeRemoval();
  }

  isNodeOrphan() {
    return super.isNodeOrphan() && this.refs === 0;
  }

  protected async run(
    _: Processed | null,
    runId: ComputationRunId
  ): Promise<ValOrError<Processed>> {
    const id = this.id++;
    const {
      graph: { builder },
      graph,
      request,
    } = this;

    const ctx = new TransformContext(builder.options, request);
    const assets = await builder.public.hooks.transform.call(ctx);

    graph.subscribeFiles(ctx.getFiles(), file => this.getDep(file, runId));

    const toDelete = new Map(this.resolutions.entries());

    for (const asset of assets) {
      const parent = {
        type: asset.type,
        id: asset.id,
        request: this.request,
      } as const;
      for (const dependency of asset.dependencies) {
        const obj = {
          dependency,
          parent,
        } as const;
        const key = serializerDepRequestAndParent(obj);
        this.resolutions.get(key, obj);
        toDelete.delete(key);
      }
    }

    // Clean
    for (const [key, resolveComp] of toDelete) {
      this.resolutions.delete(key);
      this.graph.removeNode(resolveComp);
    }

    return [
      {
        request: this.request,
        assets,
        id,
      },
      null,
    ];
  }

  protected onDone(value: Processed) {
    this.lastEvent = this.registry.addOtherJob(this.lastEvent, () => {
      this.graph.builder.public.hooks.assetDone.call(value.assets);
    });
  }

  protected onDestroy() {
    this.lastEvent = this.registry.addOtherJob(this.lastEvent, () => {
      this.graph.builder.public.hooks.assetDeleted.call(this.request);
    });
  }
}
