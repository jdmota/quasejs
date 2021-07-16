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
  RuleDeclaration,
  SelectRule,
  CallRule,
  ObjectRule,
  Call2Rule,
  TokenRules,
  TokenDeclaration,
  IntRule,
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
import { Location } from "../../runtime/tokenizer";
import { assertion, never } from "../utils";

type Gen = { [key in keyof RuleMap]: (node: RuleMap[key]) => Frag };

export class FactoryRule implements Gen {
  readonly grammar: Grammar;
  readonly rule: RuleDeclaration;
  readonly automaton: Automaton;

  constructor(grammar: Grammar, rule: RuleDeclaration, automaton: Automaton) {
    this.grammar = grammar;
    this.rule = rule;
    this.automaton = automaton;
  }

  static process(
    grammar: Grammar,
    rule: RuleDeclaration,
    automaton: Automaton
  ) {
    return new FactoryRule(grammar, rule, automaton).genRule(rule);
  }

  private token(node: TokenRules | TokenDeclaration) {
    const id = this.grammar.tokenId(node);
    return this.automaton.single(new RangeTransition(id, id));
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
    const decl = this.grammar.getRule(node.id);
    switch (decl.type) {
      case "rule":
        assertion(node.args.length === decl.args.length);
        return this.automaton.single(
          new CallTransition(node.id, node.args).setLoc(node.loc)
        );
      case "token":
        assertion(decl.modifiers.type === "normal");
        assertion(node.args.length === 0);
        return this.token(decl);
      default:
        never(decl);
    }
  }

  id(node: IdRule): Frag {
    return this.action(node);
  }

  string(node: StringRule): Frag {
    return this.token(node);
  }

  regexp(node: RegExpRule): Frag {
    return this.token(node);
  }

  eof(node: EofRule): Frag {
    return this.token(node);
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

  int(node: IntRule) {
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
