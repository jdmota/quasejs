import {
  AnyRule,
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
  CallRule,
  ObjectRule,
  Call2Rule,
  IntRule,
  BoolRule,
  ExprRule,
} from "../grammar/grammar-builder";
import { Grammar } from "../grammar/grammar";
import { Frag, Automaton } from "../automaton/automaton";
import {
  PredicateTransition,
  ActionTransition,
  CallTransition,
  RangeTransition,
  FieldInfo,
} from "../automaton/transitions";

type Gen = { [key in keyof RuleMap]: (node: RuleMap[key]) => Frag };

export abstract class AbstractFactory implements Gen {
  readonly grammar: Grammar;
  readonly automaton: Automaton;

  constructor(grammar: Grammar, automaton: Automaton) {
    this.grammar = grammar;
    this.automaton = automaton;
  }

  protected actionTransition(
    node: ExprRule,
    field: FieldInfo | null
  ): ActionTransition {
    return new ActionTransition(node, field).setLoc(node.loc);
  }

  protected abstract callTransition(
    node: CallRule,
    field: FieldInfo | null
  ): CallTransition | RangeTransition;

  abstract field(node: FieldRule): Frag;

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
    return this.automaton.single(this.callTransition(node, null));
  }

  abstract string(node: StringRule): Frag;

  abstract regexp(node: RegExpRule): Frag;

  abstract eof(node: EofRule): Frag;

  id(node: IdRule): Frag {
    return this.automaton.single(this.actionTransition(node, null));
  }

  bool(node: BoolRule) {
    return this.automaton.single(this.actionTransition(node, null));
  }

  int(node: IntRule) {
    return this.automaton.single(this.actionTransition(node, null));
  }

  object(node: ObjectRule) {
    return this.automaton.single(this.actionTransition(node, null));
  }

  call2(node: Call2Rule) {
    return this.automaton.single(this.actionTransition(node, null));
  }

  predicate(node: PredicateRule): Frag {
    return this.automaton.single(
      new PredicateTransition(node.code).setLoc(node.loc)
    );
  }

  gen(node: AnyRule): Frag {
    return this[node.type](node as any);
  }
}
