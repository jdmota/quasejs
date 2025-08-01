import { assertion, never } from "../../../util/miscellaneous.ts";
import {
  type EofRule,
  type FieldRule,
  type RegExpRule,
  type StringRule,
  type TokenRules,
  type CallRule,
  builder,
} from "../../grammar/grammar-builder.ts";
import {
  type AugmentedTokenDeclaration,
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
import { FactoryRegexp, regexpToAutomaton } from "./factory-regexp.ts";
import { type Location } from "../../runtime/input.ts";
import { AbstractFactory } from "./abstract-factory.ts";
import { State } from "../state.ts";

export class FactoryToken extends AbstractFactory {
  readonly rule: AugmentedTokenDeclaration;
  readonly fields: Map<string, boolean>;

  constructor(
    grammar: Grammar,
    rule: AugmentedTokenDeclaration,
    automaton: Automaton,
    fields: Map<string, boolean>
  ) {
    super(grammar, automaton);
    this.rule = rule;
    this.fields = fields;
  }

  static process(
    grammar: Grammar,
    token: TokenRules | AugmentedTokenDeclaration,
    automaton: Automaton,
    fields: Map<string, boolean>
  ) {
    switch (token.type) {
      case "string":
        return FactoryToken.string(automaton, token);
      case "regexp":
        return FactoryToken.regexp(automaton, token);
      case "eof":
        return FactoryToken.eof(automaton, token);
      case "token":
        return new FactoryToken(grammar, token, automaton, fields).genToken(
          token
        );
      default:
        never(token);
    }
  }

  static eof(automaton: Automaton, node: EofRule): Frag<State, AnyTransition> {
    return automaton.single(new RangeTransition(-1, -1, null).setLoc(node.loc));
  }

  static string(
    automaton: Automaton,
    node: StringRule
  ): Frag<State, AnyTransition> {
    const start = automaton.newState();
    let end = start;

    for (const char of node.string) {
      const newEnd = automaton.newState();
      const code = char.codePointAt(0)!!;
      end.addNumber(code, newEnd);
      end = newEnd;
    }

    return {
      start: start,
      end: end,
    };
  }

  static regexp(
    automaton: Automaton,
    node: RegExpRule
  ): Frag<State, AnyTransition> {
    const factoryRegexp = new FactoryRegexp(automaton);
    return regexpToAutomaton(factoryRegexp, node.regexp);
  }

  protected callTransition(
    node: CallRule,
    field: FieldInfo | null
  ): CallTransition {
    const decl = this.grammar.getRule(node.id);
    switch (decl.type) {
      case "rule":
        assertion(false);
      case "token":
        assertion(node.args.length === 0);
        return new CallTransition(node.id, [], field).setLoc(node.loc);
      default:
        never(decl);
    }
  }

  field(node: FieldRule): Frag<State, AnyTransition> {
    this.fields.set(node.name, node.multiple);
    const innerRule = node.rule;
    if (
      innerRule.type === "string" ||
      innerRule.type === "regexp" ||
      innerRule.type === "eof"
    ) {
      this.fields.set("$startMarker", false);
      const fragment = FactoryToken.process(
        this.grammar,
        innerRule,
        this.automaton,
        this.fields
      );
      const start = this.automaton.newState();
      // $startMarker = $startText();
      const startText = new ActionTransition(builder.call2("$startText", []), {
        name: "$startMarker",
        multiple: false,
      }).setLoc(node.loc);
      start.addTransition(startText, fragment.start);
      // ?? = $endText($startMarker);
      const endText = new ActionTransition(
        builder.call2("$endText", [builder.id("$startMarker")]),
        node
      ).setLoc(node.loc);
      const end = fragment.end.addTransition(
        endText,
        this.automaton.newState()
      );
      return {
        start,
        end,
      };
    } else {
      return this.automaton.single(
        innerRule.type === "call"
          ? this.callTransition(innerRule, node)
          : this.actionTransition(innerRule, node)
      );
    }
  }

  string(node: StringRule): Frag<State, AnyTransition> {
    return FactoryToken.string(this.automaton, node);
  }

  regexp(node: RegExpRule): Frag<State, AnyTransition> {
    return FactoryToken.regexp(this.automaton, node);
  }

  eof(node: EofRule): Frag<State, AnyTransition> {
    return FactoryToken.eof(this.automaton, node);
  }

  genToken(rule: AugmentedTokenDeclaration): Frag<State, AnyTransition> {
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
