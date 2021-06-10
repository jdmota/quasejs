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
  RuleDeclaration,
  SelectRule,
  CallRule,
} from "../grammar/grammar-builder";
import { Frag, Automaton } from "../automaton/automaton";
import {
  ActionTransition,
  EOFTransition,
  RuleTransition,
  ReturnTransition,
  FieldTransition,
} from "../automaton/transitions";
import { FactoryRegexp, regexpToAutomaton } from "./factory-regexp";

type Gen = { [key in keyof RuleMap]: (node: RuleMap[key]) => Frag };

export class FactoryRule implements Gen {
  readonly automaton: Automaton;
  readonly factoryRegexp: FactoryRegexp;

  constructor(automaton: Automaton) {
    this.automaton = automaton;
    this.factoryRegexp = new FactoryRegexp(this.automaton);
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
    const start = this.automaton.newState();
    const end = this.automaton.newState();
    start.addTransition(new RuleTransition(node.id, node.args), end);
    return {
      in: start,
      out: end,
    };
  }

  id(node: IdRule): Frag {
    const start = this.automaton.newState();
    const end = this.automaton.newState();
    start.addTransition(new RuleTransition(node.id, []), end);
    return {
      in: start,
      out: end,
    };
  }

  select(node: SelectRule) {
    return this.gen(node.parent);
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
    const start = this.automaton.newState();
    let end = start;

    for (const char of node.string) {
      const newEnd = this.automaton.newState();
      const code = char.codePointAt(0)!!;
      end.addNumber(code, newEnd);
      end = newEnd;
    }

    return {
      in: start,
      out: end,
    };
  }

  regexp(node: RegExpRule): Frag {
    return regexpToAutomaton(this.factoryRegexp, node.regexp);
  }

  field(node: FieldRule): Frag {
    const fragItem = this.gen(node.rule);
    const end = this.automaton.newState();
    fragItem.out.addTransition(new FieldTransition(node), end);
    return {
      in: fragItem.in,
      out: end,
    };
  }

  action(node: ActionRule): Frag {
    const start = this.automaton.newState();
    const end = this.automaton.newState();
    start.addTransition(new ActionTransition(node.code), end);
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

  genRule(rule: RuleDeclaration): Frag {
    const ruleFrag = this.gen(rule.rule);
    let start = ruleFrag.in;
    let end = ruleFrag.out;

    if (rule.modifiers.inline) {
      // TODO
    }

    if (rule.modifiers.noSkips) {
      // TODO
    }

    if (rule.modifiers.skip) {
      // TODO
    }

    if (rule.modifiers.start) {
      const newEnd = this.automaton.newState();
      end.addTransition(new EOFTransition(), newEnd);
      end = newEnd;
    }

    const newEnd = this.automaton.newState();
    end.addTransition(new ReturnTransition(rule.return), newEnd);
    end = newEnd;

    return {
      in: start,
      out: end,
    };
  }
}
