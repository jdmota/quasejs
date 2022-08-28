import { Result } from "../utils/result";
import {
  RawComputation,
  RunId,
  StateNotCreating,
  StateNotDeleted,
} from "./raw";

// TODO maybe simplify raw, and split in two: pure and stateful computations. The pure execute and can be invalidated, and run again. The stateful run once (unless it errors).

class StatefulComputationMixin<Ctx, Res> {}

export type AnyStatefulComputation = StatefulComputation<any, any>;

export class StatefulComputation<Ctx, Res> extends RawComputation<Ctx, Res> {
  protected exec(ctx: Ctx): Promise<Result<Res>> {
    throw new Error("Method not implemented.");
  }
  protected makeContext(runId: RunId): Ctx {
    throw new Error("Method not implemented.");
  }
  protected isOrphan(): boolean {
    throw new Error("Method not implemented.");
  }
  protected onStateChange(from: StateNotDeleted, to: StateNotCreating): void {
    throw new Error("Method not implemented.");
  }
  protected finishRoutine(result: Result<Res>): void {
    throw new Error("Method not implemented.");
  }
  protected invalidateRoutine(): void {
    throw new Error("Method not implemented.");
  }
  protected deleteRoutine(): void {
    throw new Error("Method not implemented.");
  }
}

// TODO
