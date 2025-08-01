import { assertion, never } from "../../../util/miscellaneous.ts";
import type {
  Assignables,
  FieldRule,
  CallRule,
  StringRule,
  RegExpRule,
  EofRule,
  TokenRules,
} from "../../grammar/grammar-builder.ts";
import {
  type AugmentedRuleDeclaration,
  Grammar,
} from "../../grammar/grammar.ts";
import { type Frag, Automaton } from "../automaton.ts";
import {
  CallTransition,
  ReturnTransition,
  RangeTransition,
  ActionTransition,
  type FieldInfo,
  type AnyTransition,
} from "../transitions.ts";
import { type Location } from "../../runtime/input.ts";
import { State } from "../state.ts";
import { AbstractFactory } from "./abstract-factory.ts";

export class FactoryRule extends AbstractFactory {
  readonly rule: AugmentedRuleDeclaration;
  readonly fields: Map<string, boolean>;

  constructor(
    grammar: Grammar,
    rule: AugmentedRuleDeclaration,
    automaton: Automaton,
    fields: Map<string, boolean>
  ) {
    super(grammar, automaton);
    this.rule = rule;
    this.fields = fields;
  }

  static process(
    grammar: Grammar,
    rule: AugmentedRuleDeclaration,
    automaton: Automaton,
    fields: Map<string, boolean>
  ) {
    return new FactoryRule(grammar, rule, automaton, fields).genRule(rule);
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
    if (field) {
      this.fields.set(field.name, field.multiple);
    }
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

  field(node: FieldRule): Frag<State, AnyTransition> {
    return this.automaton.single(this.assignablesToTransition(node.rule, node));
  }

  string(node: StringRule): Frag<State, AnyTransition> {
    return this.automaton.single(this.token(node, null));
  }

  regexp(node: RegExpRule): Frag<State, AnyTransition> {
    return this.automaton.single(this.token(node, null));
  }

  eof(node: EofRule): Frag<State, AnyTransition> {
    return this.automaton.single(this.token(node, null));
  }

  genRule(rule: AugmentedRuleDeclaration): Frag<State, AnyTransition> {
    let { start, end } = this.gen(rule.rule);

    const loc: Location | null = rule.loc
      ? { start: rule.loc.end, end: rule.loc.end }
      : null;

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
