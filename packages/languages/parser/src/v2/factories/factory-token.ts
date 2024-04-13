import {
  EofRule,
  FieldRule,
  RegExpRule,
  StringRule,
  TokenDeclaration,
  TokenRules,
  CallRule,
  builder,
} from "../grammar/grammar-builder";
import { AugmentedTokenDeclaration, Grammar } from "../grammar/grammar";
import { Frag, Automaton } from "../automaton/automaton";
import {
  CallTransition,
  ReturnTransition,
  RangeTransition,
  ActionTransition,
  FieldInfo,
} from "../automaton/transitions";
import { FactoryRegexp, regexpToAutomaton } from "./factory-regexp";
import { Location } from "../../runtime/tokenizer";
import { never, assertion } from "../utils/index";
import { AbstractFactory } from "./abstract-factory";

export class FactoryToken extends AbstractFactory {
  readonly rule: TokenDeclaration;

  constructor(grammar: Grammar, rule: TokenDeclaration, automaton: Automaton) {
    super(grammar, automaton);
    this.rule = rule;
  }

  static process(
    grammar: Grammar,
    token: TokenRules | AugmentedTokenDeclaration,
    automaton: Automaton
  ) {
    switch (token.type) {
      case "string":
        return FactoryToken.string(automaton, token);
      case "regexp":
        return FactoryToken.regexp(automaton, token);
      case "eof":
        return FactoryToken.eof(automaton, token);
      case "token":
        return new FactoryToken(grammar, token, automaton).genToken(token);
      default:
        never(token);
    }
  }

  static eof(automaton: Automaton, node: EofRule): Frag {
    return automaton.single(new RangeTransition(-1, -1, null).setLoc(node.loc));
  }

  static string(automaton: Automaton, node: StringRule): Frag {
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

  static regexp(automaton: Automaton, node: RegExpRule): Frag {
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

  field(node: FieldRule): Frag {
    const innerRule = node.rule;
    if (
      innerRule.type === "string" ||
      innerRule.type === "regexp" ||
      innerRule.type === "eof"
    ) {
      const fragment = FactoryToken.process(
        this.grammar,
        innerRule,
        this.automaton
      );
      const start = this.automaton.newState();
      // $startIndex = $getIndex();
      const getIndex = new ActionTransition(builder.call2("$getIndex", []), {
        name: "$startIndex",
        multiple: false,
      }).setLoc(node.loc);
      start.addTransition(getIndex, fragment.start);
      // ?? = $getText($startIndex);
      const getText = new ActionTransition(
        builder.call2("$getText", [builder.id("$startIndex")]),
        node
      ).setLoc(node.loc);
      const end = fragment.end.addTransition(
        getText,
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

  string(node: StringRule): Frag {
    return FactoryToken.string(this.automaton, node);
  }

  regexp(node: RegExpRule): Frag {
    return FactoryToken.regexp(this.automaton, node);
  }

  eof(node: EofRule): Frag {
    return FactoryToken.eof(this.automaton, node);
  }

  genToken(rule: AugmentedTokenDeclaration): Frag {
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
