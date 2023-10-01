import { AnyRule } from "../grammar/grammar-builder";
import { never } from "../utils";

export function formatRule(rule: AnyRule): string {
  switch (rule.type) {
    case "seq":
      return rule.rules.map(r => formatRule(r)).join(" ");
    case "choice":
      return `(${rule.rules.map(r => formatRule(r)).join(" | ")})`;
    case "repeat":
      return `(${formatRule(rule.rule)})*`;
    case "repeat1":
      return `(${formatRule(rule.rule)})+`;
    case "optional":
      return `(${formatRule(rule.rule)})?`;
    case "string":
      return JSON.stringify(rule.string);
    case "regexp":
      return `/${rule.regexp}/`;
    case "id":
      return `${rule.id}`;
    case "select":
      return `${formatRule(rule.parent)}.${rule.field}`;
    case "empty":
      return "EPSILON";
    case "eof":
      return "EOF";
    case "field":
      return `${rule.name}${rule.multiple ? "+=" : "="}${formatRule(
        rule.rule
      )}`;
    /*case "action":
      return `{${rule.action}}`;*/
    case "predicate":
      return `{${rule.code}}?`; // TODO
    default:
      never(rule);
  }
}
