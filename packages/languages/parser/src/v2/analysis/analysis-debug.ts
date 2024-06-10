import { AugmentedDeclaration } from "../grammar/grammar.ts";

export const DEBUG = {
  worthIt: false,
  keepGoing: false,
};

export function DEBUG_apply(rule: AugmentedDeclaration) {
  if (rule.modifiers._debug?.worthIt) {
    DEBUG.worthIt = true;
  }
  if (rule.modifiers._debug?.keepGoing) {
    DEBUG.keepGoing = true;
  }
}

export function DEBUG_unapply() {
  DEBUG.worthIt = false;
  DEBUG.keepGoing = false;
}
