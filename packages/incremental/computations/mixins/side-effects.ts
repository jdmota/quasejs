export class IncrementalSideEffect {}

export type SideEffectContext = {
  readonly effect: (eff: IncrementalSideEffect) => void;
};

export interface SideEffectComputation {
  readonly sideEffectMixin: SideEffectComputationMixin;
}

// TODO
export class SideEffectComputationMixin {}
