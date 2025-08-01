import type {
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
  NullRule,
} from "../../grammar/grammar-builder.ts";
import { Grammar } from "../../grammar/grammar.ts";
import { type Frag, Automaton } from "../automaton.ts";
import {
  PredicateTransition,
  ActionTransition,
  CallTransition,
  RangeTransition,
  type FieldInfo,
  type AnyTransition,
} from "../transitions.ts";
import { State } from "../state.ts";

type Gen = {
  [key in keyof RuleMap]: (node: RuleMap[key]) => Frag<State, AnyTransition>;
};

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

  abstract field(node: FieldRule): Frag<State, AnyTransition>;

  seq(node: SeqRule): Frag<State, AnyTransition> {
    return this.automaton.seq(node.rules.map(r => this.gen(r)));
  }

  choice(node: ChoiceRule): Frag<State, AnyTransition> {
    return this.automaton.choice(node.rules.map(r => this.gen(r)));
  }

  repeat(node: RepeatRule): Frag<State, AnyTransition> {
    return this.automaton.repeat(this.gen(node.rule));
  }

  repeat1(node: Repeat1Rule): Frag<State, AnyTransition> {
    return this.automaton.repeat1(this.gen(node.rule));
  }

  optional(node: OptionalRule): Frag<State, AnyTransition> {
    return this.automaton.optional(this.gen(node.rule));
  }

  empty(_: EmptyRule): Frag<State, AnyTransition> {
    return this.automaton.empty();
  }

  call(node: CallRule): Frag<State, AnyTransition> {
    return this.automaton.single(this.callTransition(node, null));
  }

  abstract string(node: StringRule): Frag<State, AnyTransition>;

  abstract regexp(node: RegExpRule): Frag<State, AnyTransition>;

  abstract eof(node: EofRule): Frag<State, AnyTransition>;

  id(node: IdRule) {
    return this.automaton.single(this.actionTransition(node, null));
  }

  bool(node: BoolRule) {
    return this.automaton.single(this.actionTransition(node, null));
  }

  int(node: IntRule) {
    return this.automaton.single(this.actionTransition(node, null));
  }

  null(node: NullRule) {
    return this.automaton.single(this.actionTransition(node, null));
  }

  object(node: ObjectRule) {
    return this.automaton.single(this.actionTransition(node, null));
  }

  call2(node: Call2Rule) {
    return this.automaton.single(this.actionTransition(node, null));
  }

  predicate(node: PredicateRule) {
    return this.automaton.single(
      new PredicateTransition(node.code).setLoc(node.loc)
    );
  }

  gen(node: AnyRule): Frag<State, AnyTransition> {
    return this[node.type](node as any);
  }
}
