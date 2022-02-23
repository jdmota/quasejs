import { ComputationDependency } from "../../utils/computation-registry";
import { BuilderGraph } from "../builder-graph";

export class FileDependency extends ComputationDependency<
  BuilderGraph,
  string
> {
  readonly path: string;
  readonly event: "addOrRemove" | "change";

  constructor(
    graph: BuilderGraph,
    path: string,
    event: "addOrRemove" | "change"
  ) {
    super(graph);
    this.path = path;
    this.event = event;
  }

  async get() {
    return [this.path, null] as const;
  }
}
