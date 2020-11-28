import { DState } from "../automaton/state";
import {
  AnyTransition,
  RuleTransition,
  RangeTransition,
  EOFTransition,
  ReturnTransition,
} from "../automaton/transitions";
import { RangeSet } from "../utils/range-set";
import { MapRangeToSet } from "../utils/map-range-to-set";
import { never } from "../utils";

type GoTo = readonly [AnyTransition, DState] | null;
type RuleName = string;

export class Analyser {
  readonly startRule: RuleName;
  readonly initialStates: Map<RuleName, DState>;
  readonly follows: Map<RuleName, Set<DState>>;
  readonly lookahead: Map<DState, RangeSet>;
  readonly conflicts: string[];

  constructor({
    startRule,
    initialStates,
    follows,
  }: {
    startRule: RuleName;
    initialStates: Map<RuleName, DState>;
    follows: Map<RuleName, Set<DState>>;
  }) {
    this.startRule = startRule;
    this.initialStates = initialStates;
    this.follows = follows;
    this.lookahead = new Map();
    this.conflicts = [];
  }

  lookaheadForState(state: DState) {
    let set = this.lookahead.get(state);
    let existed = true;
    if (!set) {
      set = new RangeSet();
      existed = false;
      this.lookahead.set(state, set);
    }
    return {
      set,
      existed,
    };
  }

  testConflict(
    ruleName: RuleName,
    state: DState,
    look: RangeTransition,
    set: Set<GoTo>
  ) {
    const arr = Array.from(set);
    if (arr.length > 1) {
      this.conflicts.push(
        `In rule ${ruleName}, in state ${state.id}, when seeing ${look}, multiple choices: ` +
          `${arr
            .map(goto => (goto ? `${goto[0]} to ${goto[1].id}` : "leave"))
            .join("; ")}`
      );
    } else if (arr.length === 0) {
      throw new Error("Assertion error");
    }
    return arr[0];
  }

  private analyzeFollows(currentRule: RuleName, set: RangeSet) {
    // TODO analyze "follows" of the "follows"
    let returns = false;
    const f = this.follows.get(currentRule);
    if (f && f.size > 0) {
      for (const dest of f) {
        returns = this.analyzeState(dest, set, new Set()) || returns;
      }
      if (currentRule === this.startRule) {
        // EOF
        set.add(new EOFTransition());
      }
    } else {
      // EOF
      set.add(new EOFTransition());
    }
    return returns;
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

  analyze(rule: RuleName, state: DState) {
    const lookData = new MapRangeToSet<GoTo>(); // look<A, B> -> if we see A, go to B
    const seen = new Set<DState>();
    seen.add(state);

    let returns = false;
    for (const tuple of state) {
      const [transition, dest] = tuple;
      const goto = new Set([tuple]);
      const set = new RangeSet();
      returns = this.analyzeTransition(transition, dest, set, seen) || returns;
      for (const look of set) {
        lookData.addRange(look.from, look.to, goto);
      }
    }

    if (returns) {
      // TODO during runtime, we might be able to refine the decisions based on the stack
      // so A (in look<A, B>) should include a stack check
      const gotos = new Set(state);
      const set = new RangeSet();
      this.analyzeFollows(rule, set);
      for (const look of set) {
        lookData.addRange(look.from, look.to, gotos);
      }
    }

    return lookData;
  }
}
