import {
  AnyRule,
  RuleMap,
  ActionRule,
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
} from "../grammar/grammar-builder";
import { Frag, Automaton } from "../automaton/automaton";
import {
  ActionTransition,
  EOFTransition,
  NamedTransition,
  RuleTransition,
} from "../automaton/transitions";

type Gen = { [key in keyof RuleMap]: (node: RuleMap[key]) => Frag };

export class FactoryRule implements Gen {
  readonly automaton: Automaton;

  constructor(automaton: Automaton) {
    this.automaton = automaton;
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

  id(node: IdRule): Frag {
    const start = this.automaton.newState();
    const end = this.automaton.newState();
    start.addTransition(new RuleTransition(node.id), end);
    return {
      in: start,
      out: end,
    };
  }

  eof(_: EofRule): Frag {
    const start = this.automaton.newState();
    const end = this.automaton.newState();
    start.addTransition(new EOFTransition(), end);
    return {
      in: start,
      out: end,
    };
  }

  string(node: StringRule): Frag {
    throw new Error(`TODO`);
  }

  regexp(node: RegExpRule): Frag {
    throw new Error(`TODO`);
  }

  field(node: FieldRule): Frag {
    const fragItem = this.gen(node.rule);

    let subTransition;
    for (const [transition] of fragItem.in) {
      subTransition = transition;
      break;
    }

    const start = this.automaton.newState();
    const end = this.automaton.newState();
    start.addTransition(
      new NamedTransition(
        node.name,
        node.multiple,
        subTransition as any // TODO
      ),
      end
    );
    return {
      in: start,
      out: end,
    };
  }

  action(node: ActionRule): Frag {
    const start = this.automaton.newState();
    const end = this.automaton.newState();
    start.addTransition(new ActionTransition(node.action), end);
    return {
      in: start,
      out: end,
    };
  }

  predicate(node: PredicateRule): Frag {
    throw new Error(`${node.type} not supported yet`);
  }

  gen(node: AnyRule): Frag {
    return this[node.type](node as any);
  }
}
