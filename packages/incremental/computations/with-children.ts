import { RunId } from "./raw";
import { Computation } from "./subscribable";

export type AnyComputationWithChildren = ComputationWithChildren<any, any, any>;

export abstract class ComputationWithChildren<
  Ctx,
  Req,
  Res
> extends Computation<Ctx, Req, Res> {
  // Parent computations and children computations
  private readonly owners: Set<AnyComputationWithChildren> = new Set();
  private readonly owned: Set<AnyComputationWithChildren> = new Set();

  own(comp: AnyComputationWithChildren) {
    this.inv();
    comp.inv();

    this.owned.add(comp);
    comp.owners.add(this);
  }

  unown(comp: AnyComputationWithChildren) {
    this.owned.delete(comp);
    comp.owners.delete(this);
  }

  protected compute(computation: AnyComputationWithChildren, runId: RunId) {
    this.active(runId);
    this.own(computation);
  }

  protected override disconnect() {
    super.disconnect();

    for (const owned of this.owned) {
      this.unown(owned);
    }
  }

  protected override isOrphan(): boolean {
    return super.isOrphan() && this.owners.size === 0;
  }
}
