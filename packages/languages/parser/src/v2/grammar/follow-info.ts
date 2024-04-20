import { DState } from "../automaton/state.ts";
import { CallTransition } from "../automaton/transitions.ts";
import { assertion, nonNull } from "../utils/index.ts";

export type FollowInfo = {
  readonly rule: string;
  readonly enterState: DState;
  readonly exitState: DState;
  readonly id: number;
};

export class FollowInfoDB {
  private follows = new Map<string, FollowInfo[]>();
  private followsById = new Map<number, FollowInfo>();
  private followsByTransition = new Map<CallTransition, FollowInfo>();
  private uuid = 0;

  add(
    contextRule: string,
    state: DState,
    transition: CallTransition,
    dest: DState
  ) {
    assertion(!this.followsByTransition.has(transition));

    const array = this.follows.get(transition.ruleName);
    const info: FollowInfo = {
      rule: contextRule,
      enterState: state,
      exitState: dest,
      id: this.uuid++,
    };
    if (array) {
      array.push(info);
    } else {
      this.follows.set(transition.ruleName, [info]);
    }
    this.followsById.set(info.id, info);
    this.followsByTransition.set(transition, info);
  }

  get(rule: string) {
    return this.follows.get(rule);
  }

  getById(id: number) {
    return nonNull(this.followsById.get(id));
  }

  getByTransition(transition: CallTransition) {
    return nonNull(this.followsByTransition.get(transition));
  }
}
