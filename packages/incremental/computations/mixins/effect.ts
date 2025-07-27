import { AnyRawComputation } from "../raw";

export type CleanupFn = (deleting: boolean) => void | Promise<void>;

const NOOP_CLEANUP: CleanupFn = () => {};

export type EffectContext = {
  readonly cleanup: (fn: CleanupFn) => void;
};

export interface IEffectComputation {
  readonly effectMixin: EffectComputationMixin;
}

export class EffectComputationMixin {
  public readonly source: AnyRawComputation & IEffectComputation;
  private cleanup: CleanupFn;

  constructor(source: AnyRawComputation & IEffectComputation) {
    this.source = source;
    this.cleanup = NOOP_CLEANUP;
  }

  makeContextRoutine(runId: number): EffectContext {
    return {
      cleanup: fn => {
        this.source.checkActive(runId);
        this.cleanup = fn;
      },
    };
  }

  async performCleanup(deleting: boolean) {
    const { cleanup } = this;
    this.cleanup = NOOP_CLEANUP;
    await cleanup(deleting);
  }

  deleteRoutine() {
    this.source.registry.queueOtherJob(this.source.description, () =>
      this.performCleanup(true)
    );
  }
}
