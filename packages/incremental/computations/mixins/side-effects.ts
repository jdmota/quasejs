import { setAdd } from "../../../util/maps-sets";
import { HashMap, ValueDefinition } from "../../utils/hash-map";
import { RawComputation } from "../raw";

export type SideEffectResult<D, U, E = unknown> =
  | {
      readonly phase: "do";
      readonly ok: true;
      readonly value: D;
    }
  | {
      readonly phase: "undo";
      readonly ok: true;
      readonly value: U;
    }
  | {
      readonly phase: "do" | "undo";
      readonly ok: false;
      readonly error: E;
    };

export abstract class SideEffectDescription<Arg, D, U> {
  abstract create(): SideEffect<Arg, D, U>;
  abstract equal(other: SideEffectDescription<any, any, any>): boolean;
  abstract hash(): number;
  abstract getCacheKey(): string;
  //
  abstract do(prev: SideEffectResult<D, U> | null, arg: Arg): Promise<D>;
  abstract undo(
    prev: SideEffectResult<D, U> | null,
    deleting: boolean
  ): Promise<U>;
}

class SideEffect<Arg, D, U> {
  private lastJob: Promise<SideEffectResult<D, U> | null>;

  constructor(readonly desc: SideEffectDescription<Arg, D, U>) {
    this.lastJob = Promise.resolve(null);
  }

  async do(arg: Arg) {
    await (this.lastJob = this.lastJob.then(async prev => {
      try {
        const value = await this.desc.do(prev, arg);
        return {
          phase: "do",
          ok: true,
          value,
        };
      } catch (error) {
        return {
          phase: "do",
          ok: false,
          error,
        };
      }
    }));
  }

  undo(deleting: boolean) {
    const p = this.lastJob.then(async prev => {
      try {
        const value = await this.desc.undo(prev, deleting);
        return {
          phase: "undo",
          ok: true,
          value,
        } as const;
      } catch (error) {
        return {
          phase: "undo",
          ok: false,
          error,
        } as const;
      }
    });
    this.lastJob = p;
    return p;
  }
}

export type SideEffectContext = {
  readonly effect: <Arg>(
    eff: SideEffectDescription<Arg, any, any>,
    arg: Arg
  ) => Promise<void>;
};

export interface SideEffectComputation {
  readonly sideEffectMixin: SideEffectComputationMixin;
}

const sideEffectDescValue: ValueDefinition<
  SideEffectDescription<any, any, any>
> = {
  hash: a => a.hash(),
  equal: (a, b) => a.equal(b),
};

// TODO support caching side-effects
export class SideEffectComputationMixin {
  private readonly source: RawComputation<any, any> & SideEffectComputation;
  private readonly effects: HashMap<
    SideEffectDescription<any, any, any>,
    SideEffect<any, any, any>
  >;
  private readonly activeEffects: Set<SideEffect<any, any, any>>;

  constructor(source: RawComputation<any, any> & SideEffectComputation) {
    this.source = source;
    this.effects = new HashMap(sideEffectDescValue);
    this.activeEffects = new Set();
  }

  makeContextRoutine(runId: number): SideEffectContext {
    return {
      effect: (eff, arg) => this.effect(runId, eff, arg),
    };
  }

  private effect<Arg>(
    runId: number,
    eff: SideEffectDescription<Arg, any, any>,
    arg: Arg
  ) {
    this.source.checkActive(runId);
    const effect = this.effects.computeIfAbsent(eff, () => eff.create());
    if (!setAdd(this.activeEffects, effect)) {
      throw new Error(`Effect already added`);
    }
    return effect.do(arg);
  }

  async postExec(runId: number) {
    this.source.checkActive(runId);
    // Undo old effects that were not renewed in this run
    const undo = [];
    for (const eff of this.effects.values()) {
      if (!this.activeEffects.has(eff)) undo.push(eff);
    }
    await Promise.all(
      undo.map(eff =>
        eff.undo(false).then(() => {
          // Check we are still running...
          // (It could happen that some "undo" action errored,
          // and the computation was invalidated, so we keep the effect
          // and will try to undo again in the next run)
          this.source.checkActive(runId);
          this.effects.delete(eff.desc);
        })
      )
    );
  }

  invalidateRoutine() {
    this.activeEffects.clear();
  }

  deleteRoutine() {
    const { source, effects, activeEffects } = this;
    activeEffects.clear();
    for (const eff of effects.values()) {
      source.registry.queueOtherJob(source.description, () =>
        eff.undo(true).then(result => {
          if (!result.ok) {
            throw result.error;
          }
        })
      );
    }
  }
}
