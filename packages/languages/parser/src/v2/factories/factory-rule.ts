import {
  Assignables,
  FieldRule,
  CallRule,
  StringRule,
  RegExpRule,
  EofRule,
  TokenRules,
} from "../grammar/grammar-builder";
import { AugmentedRuleDeclaration, Grammar } from "../grammar/grammar";
import { Frag, Automaton } from "../automaton/automaton";
import {
  CallTransition,
  ReturnTransition,
  RangeTransition,
  ActionTransition,
  FieldInfo,
} from "../automaton/transitions";
import { Location } from "../../runtime/tokenizer";
import { assertion, never } from "../utils/index";
import { AbstractFactory } from "./abstract-factory";

export class FactoryRule extends AbstractFactory {
  readonly rule: AugmentedRuleDeclaration;

  constructor(
    grammar: Grammar,
    rule: AugmentedRuleDeclaration,
    automaton: Automaton
  ) {
    super(grammar, automaton);
    this.rule = rule;
  }

  static process(
    grammar: Grammar,
    rule: AugmentedRuleDeclaration,
    automaton: Automaton
  ) {
    return new FactoryRule(grammar, rule, automaton).genRule(rule);
  }

  protected callTransition(
    node: CallRule,
    field: FieldInfo | null
  ): CallTransition | RangeTransition {
    const decl = this.grammar.getRule(node.id);
    switch (decl.type) {
      case "rule":
        assertion(node.args.length === decl.args.length);
        return new CallTransition(node.id, node.args, field).setLoc(node.loc);
      case "token":
        assertion(decl.modifiers.type === "normal");
        assertion(node.args.length === 0);
        const id = this.grammar.tokenId(decl);
        return new RangeTransition(id, id, field);
      default:
        never(decl);
    }
  }

  private token(node: TokenRules, field: FieldInfo | null) {
    const id = this.grammar.tokenId(node);
    return new RangeTransition(id, id, field);
  }

  private assignablesToTransition(
    node: Assignables,
    field: FieldInfo | null
  ): CallTransition | ActionTransition | RangeTransition {
    switch (node.type) {
      case "string":
      case "regexp":
      case "eof":
        return this.token(node, field);
      case "call":
        return this.callTransition(node, field);
      default:
        return this.actionTransition(node, field);
    }
  }

  field(node: FieldRule): Frag {
    return this.automaton.single(this.assignablesToTransition(node.rule, node));
  }

  string(node: StringRule): Frag {
    return this.automaton.single(this.token(node, null));
  }

  regexp(node: RegExpRule): Frag {
    return this.automaton.single(this.token(node, null));
  }

  eof(node: EofRule): Frag {
    return this.automaton.single(this.token(node, null));
  }

  genRule(rule: AugmentedRuleDeclaration): Frag {
    let { start, end } = this.gen(rule.rule);

    const loc: Location | null = rule.loc
      ? { start: rule.loc.end, end: rule.loc.end }
      : null;

    if (rule.modifiers.start) {
      const newEnd = this.automaton.newState();
      end.addTransition(new RangeTransition(-1, -1, null).setLoc(loc), newEnd);
      end = newEnd;
    }

    const newEnd = this.automaton.newState();
    end.addTransition(
      new ReturnTransition(rule.name, rule.return).setLoc(loc),
      newEnd
    );
    end = newEnd;

    return {
      start,
      end,
    };
  }
}
