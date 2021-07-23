import {
  RuleDeclaration,
  Assignables,
  FieldRule,
  CallRule,
  StringRule,
  RegExpRule,
  EofRule,
  TokenRules,
} from "../grammar/grammar-builder";
import { Grammar } from "../grammar/grammar";
import { Frag, Automaton } from "../automaton/automaton";
import {
  CallTransition,
  ReturnTransition,
  RangeTransition,
  AssignableTransition,
  FieldTransition,
} from "../automaton/transitions";
import { Location } from "../../runtime/tokenizer";
import { assertion, never } from "../utils";
import { AbstractFactory } from "./abstract-factory";

export class FactoryRule extends AbstractFactory {
  readonly rule: RuleDeclaration;

  constructor(grammar: Grammar, rule: RuleDeclaration, automaton: Automaton) {
    super(grammar, automaton);
    this.rule = rule;
  }

  static process(
    grammar: Grammar,
    rule: RuleDeclaration,
    automaton: Automaton
  ) {
    return new FactoryRule(grammar, rule, automaton).genRule(rule);
  }

  protected callTransition(node: CallRule): CallTransition | RangeTransition {
    const decl = this.grammar.getRule(node.id);
    switch (decl.type) {
      case "rule":
        assertion(node.args.length === decl.args.length);
        return new CallTransition(node.id, node.args).setLoc(node.loc);
      case "token":
        assertion(decl.modifiers.type === "normal");
        assertion(node.args.length === 0);
        const id = this.grammar.tokenId(decl);
        return new RangeTransition(id, id);
      default:
        never(decl);
    }
  }

  private token(node: TokenRules) {
    const id = this.grammar.tokenId(node);
    return new RangeTransition(id, id);
  }

  private assignablesToTransition(node: Assignables): AssignableTransition {
    switch (node.type) {
      case "string":
      case "regexp":
      case "eof":
        return this.token(node);
      case "call":
        return this.callTransition(node);
      default:
        return this.actionTransition(node);
    }
  }

  field(node: FieldRule): Frag {
    const transition = this.assignablesToTransition(node.rule);
    const fragItem = this.automaton.single(transition);
    const end = this.automaton.newState();
    fragItem.end.addTransition(
      new FieldTransition(node.name, node.multiple, transition).setLoc(
        node.loc
      ),
      end
    );
    return {
      start: fragItem.start,
      end,
    };
  }

  string(node: StringRule): Frag {
    return this.automaton.single(this.token(node));
  }

  regexp(node: RegExpRule): Frag {
    return this.automaton.single(this.token(node));
  }

  eof(node: EofRule): Frag {
    return this.automaton.single(this.token(node));
  }

  genRule(rule: RuleDeclaration): Frag {
    let { start, end } = this.gen(rule.rule);

    if (rule.modifiers.inline) {
      // TODO
    }

    if (rule.modifiers.noSkips) {
      // TODO
    }

    const loc: Location | null = rule.loc
      ? { start: rule.loc.end, end: rule.loc.end }
      : null;

    if (rule.modifiers.start) {
      const newEnd = this.automaton.newState();
      end.addTransition(new RangeTransition(-1, -1).setLoc(loc), newEnd);
      end = newEnd;
    }

    const newEnd = this.automaton.newState();
    end.addTransition(new ReturnTransition(rule.return).setLoc(loc), newEnd);
    end = newEnd;

    return {
      start,
      end,
    };
  }
}
