import path from "path";
import { type Rule, PART_VALUES, TYPE_VALUES } from "./types";
import anyRules from "./git-deny-patterns.json" with { type: "json" };

function assertErr() {
  return new Error(`Assertion error`);
}

function validateJsonRules(anyRules: unknown): Rule[] {
  if (!Array.isArray(anyRules)) throw assertErr();

  const rules: Rule[] = [];

  for (const anyRule of anyRules) {
    if (typeof anyRule !== "object" || anyRule == null) throw assertErr();
    if (!PART_VALUES.includes(anyRule.part)) throw assertErr();
    if (!TYPE_VALUES.includes(anyRule.type)) throw assertErr();
    if (typeof anyRule.pattern !== "string") throw assertErr();
    if (typeof anyRule.caption !== "string") throw assertErr();
    if (typeof anyRule.description !== "string" && anyRule.description !== null)
      throw assertErr();
    rules.push(anyRule);
  }

  return rules;
}

const ANY_RULES = validateJsonRules(anyRules);

function toR(pattern: string) {
  const jsPattern = pattern.replace("\\A", "^").replace("\\z", "$");
  return new RegExp(jsPattern);
}

function extension(filename: string) {
  // Remove leading dot
  return path.extname(filename).slice(1);
}

const filePartsGetters = {
  filename: path.basename as (x: string) => string,
  path: (x: string) => x,
  extension,
};

const regRules = {
  regex(pattern: string) {
    const reg = toR(pattern);
    return (str: string) => reg.test(str);
  },
  match(pattern: string) {
    return (str: string) => str === pattern;
  },
};

function ruleToTester(rule: Rule) {
  const getFilePart = filePartsGetters[rule.part];
  const matcher = regRules[rule.type](rule.pattern);
  return (filename: string) => {
    const part = getFilePart(filename);
    return matcher(part);
  };
}

const testers = ANY_RULES.map(rule => ({ rule, tester: ruleToTester(rule) }));

export function isBanned(filename: string) {
  const rules: Rule[] = [];
  for (const { rule, tester } of testers) {
    if (tester(filename)) {
      rules.push(rule);
    }
  }
  return rules;
}
