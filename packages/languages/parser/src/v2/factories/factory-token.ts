import {
  AnyRule,
  ExprRule,
  RuleMap,
  ChoiceRule,
  EmptyRule,
  EofRule,
  FieldRule,
  IdRule,
  OptionalRule,
  PredicateRule,
  RegExpRule,
  Repeat1Rule,
  RepeatRule,
  SeqRule,
  StringRule,
  SelectRule,
  CallRule,
  ObjectRule,
  Call2Rule,
  TokenDeclaration,
  TokenRules,
} from "../grammar/grammar-builder";
import { Grammar } from "../grammar/grammar";
import { Frag, Automaton } from "../automaton/automaton";
import {
  ActionTransition,
  CallTransition,
  ReturnTransition,
  FieldTransition,
  PredicateTransition,
  RangeTransition,
} from "../automaton/transitions";
import { FactoryRegexp, regexpToAutomaton } from "./factory-regexp";
import { Location } from "../../runtime/tokenizer";
import { never, assertion } from "../utils";

type Gen = { [key in keyof RuleMap]: (node: RuleMap[key]) => Frag };

export class FactoryToken implements Gen {
  readonly grammar: Grammar;
  readonly rule: TokenDeclaration;
  readonly automaton: Automaton;

  constructor(grammar: Grammar, rule: TokenDeclaration, automaton: Automaton) {
    this.grammar = grammar;
    this.rule = rule;
    this.automaton = automaton;
  }

  static process(
    grammar: Grammar,
    token: TokenRules | TokenDeclaration,
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
    return automaton.single(new RangeTransition(-1, -1).setLoc(node.loc));
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

  private action(node: ExprRule): Frag {
    return this.automaton.single(new ActionTransition(node).setLoc(node.loc));
  }

  seq(node: SeqRule): Frag {
    return this.automaton.seq(node.rules.map(r => this.gen(r)));
  }

  choice(node: ChoiceRule): Frag {
    return this.automaton.choice(node.rules.map(r => this.gen(r)));
  }

  repeat(node: RepeatRule): Frag {
    return this.automaton.repeat(this.gen(node.rule));
  }

  repeat1(node: Repeat1Rule): Frag {
    return this.automaton.repeat1(this.gen(node.rule));
  }

  optional(node: OptionalRule): Frag {
    return this.automaton.optional(this.gen(node.rule));
  }

  empty(_: EmptyRule): Frag {
    return this.automaton.empty();
  }

  call(node: CallRule): Frag {
    const decl = this.grammar.getRule(node.id).decl;
    switch (decl.type) {
      case "rule":
        assertion(false);
      case "token":
        assertion(node.args.length === 0);
        return this.automaton.single(
          new CallTransition(node.id, []).setLoc(node.loc)
        );
      default:
        never(decl);
    }
  }

  id(node: IdRule): Frag {
    return this.action(node);
  }

  eof(node: EofRule): Frag {
    return FactoryToken.eof(this.automaton, node);
  }

  string(node: StringRule): Frag {
    return FactoryToken.string(this.automaton, node);
  }

  regexp(node: RegExpRule): Frag {
    return FactoryToken.regexp(this.automaton, node);
  }

  field(node: FieldRule): Frag {
    const fragItem = this.gen(node.rule);
    const end = this.automaton.newState();
    fragItem.end.addTransition(new FieldTransition(node).setLoc(node.loc), end);
    return {
      start: fragItem.start,
      end: end,
    };
  }

  select(node: SelectRule) {
    return this.action(node);
  }

  object(node: ObjectRule) {
    return this.action(node);
  }

  call2(node: Call2Rule) {
    return this.action(node);
  }

  predicate(node: PredicateRule): Frag {
    return this.automaton.single(
      new PredicateTransition(node.code).setLoc(node.loc)
    );
  }

  gen(node: AnyRule): Frag {
    return this[node.type](node as any);
  }

  genToken(rule: TokenDeclaration): Frag {
    let { start, end } = this.gen(rule.rule);

    const loc: Location | null = rule.loc
      ? { start: rule.loc.end, end: rule.loc.end }
      : null;

    const newEnd = this.automaton.newState();
    end.addTransition(new ReturnTransition(rule.return).setLoc(loc), newEnd);
    end = newEnd;

    return {
      start,
      end,
    };
  }
}
