import regexpTree from "regexp-tree";
import type {
  AstRegExp,
  Char,
  ClassRange,
  CharacterClass,
  Alternative,
  Disjunction,
  Group,
  Backreference,
  Repetition,
  Assertion,
  Expression,
} from "regexp-tree/ast";
import { type Frag, Automaton } from "../automaton/automaton.ts";
import { MIN_CHAR, MAX_CHAR } from "../constants.ts";
import { State } from "../automaton/state.ts";
import { type AnyTransition } from "../automaton/transitions.ts";

const { parse: parseRegexp } = regexpTree;

declare module "regexp-tree/ast" {
  interface SimpleChar extends Base<"Char"> {
    codePoint: number;
  }
  interface SpecialChar extends Base<"Char"> {
    codePoint: number;
  }
  interface Disjunction extends Base<"Disjunction"> {
    left: Expression | null;
    right: Expression | null;
  }
}

interface AstClassMap {
  RegExp: AstRegExp;
  Disjunction: Disjunction;
  Alternative: Alternative;
  Assertion: Assertion;
  Char: Char;
  CharacterClass: CharacterClass;
  ClassRange: ClassRange;
  Backreference: Backreference;
  Group: Group;
  Repetition: Repetition;
  // Quantifier: Quantifier;
}

type AstClass = keyof AstClassMap;
type AstNode = AstClassMap[AstClass];
type Gen = {
  [key in keyof AstClassMap]: (
    node: AstClassMap[key]
  ) => Frag<State, AnyTransition>;
};

const WS = [" ", "\t", "\r", "\n", "\v", "\f"].map(c => c.charCodeAt(0));

function disjunctionToList(node: Disjunction): (Expression | null)[] {
  return node.left?.type === "Disjunction"
    ? [...disjunctionToList(node.left), node.right]
    : [node.left, node.right];
}

export class FactoryRegexp implements Gen {
  readonly automaton: Automaton;

  constructor(automaton: Automaton) {
    this.automaton = automaton;
  }

  c(code: number): Frag<State, AnyTransition> {
    const start = this.automaton.newState();
    const end = this.automaton.newState();
    start.addNumber(code, end);
    return { start, end };
  }

  Char(char: Char) {
    const { codePoint, value, kind } = char;
    if (value === "\\s") {
      const frags = WS.map(c => this.c(c));
      return this.automaton.choice(frags);
    }
    if (codePoint == null || Number.isNaN(codePoint)) {
      throw new Error(
        `Char of kind ${kind} is not supported - ${JSON.stringify(char)}`
      );
    }
    return this.c(codePoint);
  }

  CharacterClass({ negative, expressions }: CharacterClass) {
    if (negative) {
      const list = expressions.map(e =>
        e.type === "ClassRange"
          ? ([e.from.codePoint, e.to.codePoint] as const)
          : ([e.codePoint, e.codePoint] as const)
      );
      const start = this.automaton.newState();
      const end = this.automaton.newState();
      start.addNotRangeSet(list, end, MIN_CHAR, MAX_CHAR);
      return { start, end };
    }
    const fragments = expressions.map(e => this.gen(e));
    return this.automaton.choice(fragments);
  }

  ClassRange({ from, to }: ClassRange) {
    const start = this.automaton.newState();
    const end = this.automaton.newState();
    start.addRange(from.codePoint, to.codePoint, end);
    return { start, end };
  }

  Alternative({ expressions }: Alternative) {
    const fragments = expressions.map(e => this.gen(e));
    return this.automaton.seq(fragments);
  }

  Disjunction(node: Disjunction) {
    // DO NOT use use "expressions", the type definition of Disjunction is wrong
    const fragments = disjunctionToList(node).map(e => this.gen(e));
    return this.automaton.choice(fragments);
  }

  Group(group: Group) {
    if (group.capturing && group.name) {
      throw new Error(`Named group capturing is not supported`);
    }
    return this.gen(group.expression);
  }

  Backreference(_: Backreference): Frag<State, AnyTransition> {
    throw new Error(`Backreferences are not supported`);
  }

  Repetition({ quantifier, expression }: Repetition) {
    const { kind, greedy } = quantifier;
    if (!greedy) {
      throw new Error(`Non-greedy repetition is not supported`);
    }
    switch (quantifier.kind) {
      case "*":
        return this.automaton.repeat(this.gen(expression));
      case "+":
        return this.automaton.repeat1(this.gen(expression));
      case "?":
        return this.automaton.optional(this.gen(expression));
      case "Range":
        if (quantifier.from === 0 && quantifier.to == null) {
          return this.automaton.repeat(this.gen(expression));
        }
        if (quantifier.from === 1 && quantifier.to == null) {
          return this.automaton.repeat1(this.gen(expression));
        }
        if (quantifier.from === 0 && quantifier.to === 1) {
          return this.automaton.optional(this.gen(expression));
        }
        // TODO
        throw new Error(
          `Repetition range {${quantifier.from},${
            quantifier.to || ""
          }} is not supported yet`
        );
      default:
        throw new Error(`Repetition of kind ${kind} is not supported`);
    }
  }

  Assertion(_: Assertion): Frag<State, AnyTransition> {
    throw new Error(`Assertions are not supported`);
  }

  RegExp(node: AstRegExp) {
    if (node.flags) {
      throw new Error("Flags are not supported yet");
    }
    return this.gen(node.body);
  }

  gen(node: AstNode | null): Frag<State, AnyTransition> {
    if (node) {
      return this[node.type](node as any);
    }
    return this.automaton.empty();
  }
}

export function regexpToAutomaton(factory: FactoryRegexp, rawRegExp: string) {
  return factory.RegExp(parseRegexp(rawRegExp));
}
