import { AnyRawComputation, RunId } from "../raw";

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

  makeContextRoutine(runId: RunId): EffectContext {
    return {
      cleanup: fn => {
        this.source.checkActive(runId);
        this.cleanup = fn;
      },
    };
  }

  async performCleanup(deleting: boolean) {
    const { source, cleanup } = this;
    this.cleanup = NOOP_CLEANUP;
    try {
      await cleanup(deleting);
    } catch (err) {
      if (deleting) {
        source.registry.emitUncaughtError(source.description, err);
      } else {
        throw err;
      }
    }
  }

  deleteRoutine(): void {
    this.source.registry.queueOtherJob(() => this.performCleanup(true));
  }
}
