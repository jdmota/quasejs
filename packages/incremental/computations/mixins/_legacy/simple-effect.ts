import { AnyRawComputation } from "../../raw";

export type CleanupFn = (deleting: boolean) => void | Promise<void>;

const NOOP_CLEANUP: CleanupFn = () => {};

export type SimpleEffectContext = {
  readonly cleanup: (fn: CleanupFn) => void;
};

export interface SimpleEffectComputation {
  readonly simpleEffectMixin: SimpleEffectComputationMixin;
}

export class SimpleEffectComputationMixin {
  public readonly source: AnyRawComputation & SimpleEffectComputation;
  private cleanup: CleanupFn;

  constructor(source: AnyRawComputation & SimpleEffectComputation) {
    this.source = source;
    this.cleanup = NOOP_CLEANUP;
  }

  makeContextRoutine(runId: number): SimpleEffectContext {
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
