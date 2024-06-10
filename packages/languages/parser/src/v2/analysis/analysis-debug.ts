import { AugmentedDeclaration } from "../grammar/grammar.ts";

export const DEBUG = {
  worthIt: false,
  keepGoing: false,
};

const previousDebugs: (typeof DEBUG)[] = [];

export function DEBUG_apply(rule: AugmentedDeclaration) {
  previousDebugs.push({ ...DEBUG });
  DEBUG.worthIt = !!rule.modifiers._debug?.worthIt;
  DEBUG.keepGoing = !!rule.modifiers._debug?.keepGoing;
}

export function DEBUG_unapply() {
  const previous = previousDebugs.pop() ?? {
    worthIt: false,
    keepGoing: false,
  };
  DEBUG.worthIt = previous.worthIt;
  DEBUG.keepGoing = previous.keepGoing;
}
