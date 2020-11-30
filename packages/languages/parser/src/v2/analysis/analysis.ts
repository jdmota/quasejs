import { DState } from "../automaton/state";
import {
  AnyTransition,
  RuleTransition,
  RangeTransition,
  ReturnTransition,
} from "../automaton/transitions";
import { RangeSet } from "../utils/range-set";
import { MapRangeToSet } from "../utils/map-range-to-set";
import { MapKeyToValue } from "../utils/map-key-to-value";
import { never } from "../utils";

type RuleName = string;
type GoTo = readonly [AnyTransition, DState] | null;
type FollowInfo = {
  readonly caller: RuleName;
  readonly enterState: DState;
  readonly followingState: DState;
};
type FollowLookahead = {
  readonly stack: FollowStack;
  readonly ranges: RangeSet;
};

class FollowStack {
  readonly parent: FollowStack | null;
  readonly followInfo: FollowInfo;
  private cachedHashCode: number;

  constructor(parent: FollowStack | null, followInfo: FollowInfo) {
    this.parent = parent;
    this.followInfo = followInfo;
    this.cachedHashCode = 0;
  }

  hashCode(): number {
    if (this.cachedHashCode === 0) {
      const parent = this.parent == null ? 1 : this.parent.hashCode();
      const { caller, enterState, followingState } = this.followInfo;
      this.cachedHashCode =
        parent * caller.length * enterState.id * followingState.id;
    }
    return this.cachedHashCode;
  }

  equals(other: unknown): boolean {
    if (this === other) {
      return true;
    }
    if (other instanceof FollowStack) {
      if (
        this.followInfo.caller !== other.followInfo.caller ||
        this.followInfo.enterState !== other.followInfo.enterState ||
        this.followInfo.followingState !== other.followInfo.followingState
      ) {
        return false;
      }
      if (this.parent === null) {
        return other.parent === null;
      }
      return this.parent.equals(other.parent);
    }
    return false;
  }
}

export class Analyser {
  readonly startRule: RuleName;
  readonly initialStates: Map<RuleName, DState>;
  readonly follows: Map<RuleName, FollowInfo[]>;

  constructor({
    startRule,
    initialStates,
    follows,
  }: {
    startRule: RuleName;
    initialStates: Map<RuleName, DState>;
    follows: Map<RuleName, FollowInfo[]>;
  }) {
    this.startRule = startRule;
    this.initialStates = initialStates;
    this.follows = follows;
  }

  private analyzeFollows(
    caller: RuleName,
    followStack: FollowStack | null,
    result: FollowLookahead[] = [],
    seen: Set<RuleName> = new Set()
  ) {
    if (seen.has(caller)) return result;
    seen.add(caller);

    const f = this.follows.get(caller);
    if (f && f.length > 0) {
      for (const info of f) {
        const set = new RangeSet();
        const returns = this.analyzeState(info.followingState, set, new Set());
        if (returns) {
          const newFollowStack = new FollowStack(followStack, info);
          result.push({
            stack: newFollowStack,
            ranges: set,
          });
          this.analyzeFollows(info.caller, newFollowStack, result, seen);
        }
      }
    }
    return result;
  }

  private analyzeState(
    state: DState,
    set: RangeSet,
    seen: Set<DState>
  ): boolean {
    if (seen.has(state)) return false;
    seen.add(state);

    let returns = false;
    for (const [transition, dest] of state) {
      returns = this.analyzeTransition(transition, dest, set, seen) || returns;
    }
    return returns;
  }

  // TODO cache stuff

  // Returns true if analysis should continue to the "caller" rule
  private analyzeTransition(
    transition: AnyTransition,
    dest: DState,
    set: RangeSet,
    seen: Set<DState>
  ): boolean {
    if (transition instanceof RuleTransition) {
      const result = this.analyzeState(
        this.initialStates.get(transition.ruleName)!!,
        set,
        seen
      );
      return result ? this.analyzeState(dest, set, seen) : result;
    }
    if (transition instanceof RangeTransition) {
      set.add(transition);
      return false;
    }
    if (transition instanceof ReturnTransition) {
      return true;
    }
    if (transition.isEpsilon) {
      return this.analyzeState(dest, set, seen);
    }
    never(transition);
  }

  // Analysis assumes that "return" transitions are added and that
  // the initial rule is adapted to include the EOFTransition

  analyze(rule: RuleName, state: DState) {
    // Prevent stack overflow
    const seen = new Set<DState>();
    seen.add(state);

    // Results
    const lookahead = new MapRangeToSet<GoTo>(); // Given a range, go to destination indicated by GoTo
    const followsLookahead = new MapKeyToValue<
      FollowStack,
      MapRangeToSet<GoTo>
    >(); // Given a stack, and a range, go to destination indicated by GoTo

    // For each transition on this state,
    // compute the conditions for that transition to be performed
    for (const tuple of state) {
      const [transition, dest] = tuple;
      const goto = new Set([tuple]);

      // Compute lookahead without stack check
      const ranges = new RangeSet();
      const returns = this.analyzeTransition(transition, dest, ranges, seen);

      for (const look of ranges) {
        lookahead.addRange(look.from, look.to, goto);
      }

      // If the analysis reached the end of the rule,
      // We need to consider where the rule is used, and potentially the stack
      if (returns) {
        const follows = this.analyzeFollows(rule, null);
        for (const { stack, ranges } of follows) {
          const lookahead = followsLookahead.computeIfAbsent(
            stack,
            () => new MapRangeToSet()
          );
          for (const look of ranges) {
            lookahead.addRange(look.from, look.to, goto);
          }
        }
      }
    }

    return {
      lookahead,
      followsLookahead,
    };
  }
}
