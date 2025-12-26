import { HashMap } from "../../utils/hash-map";
import type { Version } from "../../utils/versions";
import {
  type CellValueDescriptions,
  IncrementalFunctionCallDescription,
  IncrementalFunctionRegistry,
} from "./functions";
import { IncrementalFunctionRuntime } from "./function-runtime";

export class IncrementalBackend {
  public readonly functions = new IncrementalFunctionRegistry();

  private map: HashMap<
    IncrementalFunctionCallDescription<any, any, any>,
    IncrementalFunctionRuntime<any, any, any>
  >;
  private sessionVersion = 0;
  private nextVersion = 0;

  constructor() {
    this.map = new HashMap({
      equal: (a, b) => a.equal(b),
      hash: a => a.hash(),
    });
  }

  make<Input, Output, CellDefs extends CellValueDescriptions>(
    desc: IncrementalFunctionCallDescription<Input, Output, CellDefs>
  ): IncrementalFunctionRuntime<Input, Output, CellDefs> {
    this.functions.check(desc.schema);
    return this.map.computeIfAbsent(
      desc,
      () => new IncrementalFunctionRuntime(this, desc)
    );
  }

  getNextVersion(): Version {
    // 0: Distinguish between different sessions
    // 1: Distinguish between different versions in this session
    // (we rely on a global value to ensure that even
    // deleted then recreated computations have different versions)
    return [this.sessionVersion, this.nextVersion++];
  }

  onFunctionError(
    desc: IncrementalFunctionCallDescription<any, any, any>,
    err: any
  ) {
    // TODO
  }
}
