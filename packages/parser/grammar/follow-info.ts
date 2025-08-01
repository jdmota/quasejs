import { assertion, nonNull } from "../../util/miscellaneous.ts";
import { type Range } from "../../util/range-utils.ts";
import { DState } from "../automaton/state.ts";
import { CallTransition } from "../automaton/transitions.ts";
import { EOF_RANGE } from "../utils/index.ts";
import { LEXER_RULE_NAME } from "./tokens.ts";

export type FollowInfo = {
  readonly rule: string;
  readonly exitState: DState;
  readonly id: number;
};

export class FollowInfoDB {
  private follows = new Map<string, FollowInfo[]>();
  private followsById = new Map<number, FollowInfo>();
  private followsByTransition = new Map<CallTransition, FollowInfo>();
  private followsByRuleExit = new Map<string, FollowInfo>();
  private uuid = 0;

  anyRange(): Range {
    return { from: -1, to: this.uuid - 1 };
  }

  getIdRangeByIndex(rule: string, index: number) {
    let arr = this.get(rule);
    let minus1 = arr.length === 0;
    for (let i = 2; i <= index; i++) {
      arr = arr
        .map(info => {
          const a = this.get(info.rule);
          minus1 ||= a.length === 0;
          return a;
        })
        .flat();
    }
    const result = arr.map(info => info.id);
    if (minus1) result.push(EOF_RANGE.from);
    return result;
  }

  add(contextRule: string, transition: CallTransition, dest: DState) {
    assertion(!this.followsByTransition.has(transition));
    //
    const key = `${contextRule}\0${dest.id}`;
    let info = this.followsByRuleExit.get(key);
    if (!info) {
      info = {
        rule: contextRule,
        exitState: dest,
        id: this.uuid++,
      };
      this.followsByRuleExit.set(key, info);
      this.followsById.set(info.id, info);
    }
    //
    const array = this.follows.get(transition.ruleName);
    if (array) {
      array.push(info);
    } else {
      this.follows.set(transition.ruleName, [info]);
    }
    this.followsByTransition.set(transition, info);
  }

  addLexerFollow(startState: DState) {
    return this.add(
      LEXER_RULE_NAME,
      new CallTransition(LEXER_RULE_NAME, [], null),
      startState
    );
  }

  get(rule: string) {
    return this.follows.get(rule) ?? [];
  }

  getById(id: number) {
    return nonNull(this.followsById.get(id));
  }

  getByTransition(transition: CallTransition) {
    return nonNull(this.followsByTransition.get(transition));
  }

  getByRuleExitState(rule: string, exitState: DState) {
    const key = `${rule}\0${exitState.id}`;
    return nonNull(this.followsByRuleExit.get(key));
  }
}
