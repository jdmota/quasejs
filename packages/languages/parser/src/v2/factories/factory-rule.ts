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
} from "../grammar/grammar-builder";
import { Frag, Automaton } from "../automaton/automaton";
import {
  ActionTransition,
  EOFTransition,
  RuleTransition,
  ReturnTransition,
  FieldTransition,
  PredicateTransition,
} from "../automaton/transitions";
import { FactoryRegexp, regexpToAutomaton } from "./factory-regexp";
import { Location } from "../../runtime/tokenizer";

type Gen = { [key in keyof RuleMap]: (node: RuleMap[key]) => Frag };

export class FactoryRule implements Gen {
  readonly automaton: Automaton;
  readonly factoryRegexp: FactoryRegexp;

  constructor() {
    this.automaton = new Automaton();
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
    start.addTransition(
      new RuleTransition(node.id, node.args).setLoc(node.loc),
      end
    );
    return {
      in: start,
      out: end,
    };
  }

  id(node: IdRule): Frag {
    const start = this.automaton.newState();
    const end = this.automaton.newState();
    start.addTransition(new RuleTransition(node.id, []).setLoc(node.loc), end);
    return {
      in: start,
      out: end,
    };
  }

  eof(node: EofRule): Frag {
    const start = this.automaton.newState();
    const end = this.automaton.newState();
    start.addTransition(new EOFTransition().setLoc(node.loc), end);
    return {
      in: start,
      out: end,
    };
  }

  string(node: StringRule): Frag {
    // TODO what if this is not a lexer?
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
    // TODO what if this not a lexer?
    return regexpToAutomaton(this.factoryRegexp, node.regexp);
  }

  field(node: FieldRule): Frag {
    const fragItem = this.gen(node.rule);
    const end = this.automaton.newState();
    fragItem.out.addTransition(new FieldTransition(node).setLoc(node.loc), end);
    return {
      in: fragItem.in,
      out: end,
    };
  }

  private action(node: ExprRule): Frag {
    const start = this.automaton.newState();
    const end = this.automaton.newState();
    start.addTransition(new ActionTransition(node).setLoc(node.loc), end);
    return {
      in: start,
      out: end,
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
    const start = this.automaton.newState();
    const end = this.automaton.newState();
    start.addTransition(
      new PredicateTransition(node.code).setLoc(node.loc),
      end
    );
    return {
      in: start,
      out: end,
    };
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

    const loc: Location | null = rule.loc
      ? { start: rule.loc.end, end: rule.loc.end }
      : null;

    if (rule.modifiers.start) {
      const newEnd = this.automaton.newState();
      end.addTransition(new EOFTransition().setLoc(loc), newEnd);
      end = newEnd;
    }

    const newEnd = this.automaton.newState();
    end.addTransition(new ReturnTransition(rule.return).setLoc(loc), newEnd);
    end = newEnd;

    return {
      in: start,
      out: end,
    };
  }
}
