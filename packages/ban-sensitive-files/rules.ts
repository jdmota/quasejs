import path from "path";
import {
  type PatternCheck,
  type BanRule,
  type ContentRule as ContentRule,
  PART_VALUES,
  TYPE_VALUES,
} from "./types";
import anyBanRules from "./ban-rules.json" with { type: "json" };
import anyContentRules from "./content-rules.json" with { type: "json" };

function assertErr() {
  return new Error(`Assertion error`);
}

function validatePatternCheck(anyPattern: any): PatternCheck {
  if (typeof anyPattern !== "object" || anyPattern == null) throw assertErr();
  if (!TYPE_VALUES.includes(anyPattern.type)) throw assertErr();
  if (typeof anyPattern.pattern !== "string") throw assertErr();
  return anyPattern;
}

function validateBanRule(anyRule: any): BanRule {
  validatePatternCheck(anyRule);
  if (!PART_VALUES.includes(anyRule.part)) throw assertErr();
  if (typeof anyRule.caption !== "string" && anyRule.description != null)
    throw assertErr();
  if (typeof anyRule.description !== "string" && anyRule.description != null)
    throw assertErr();
  return anyRule;
}

function validateContentRule(anyRule: any): ContentRule {
  validateBanRule(anyRule);
  if (!Array.isArray(anyRule.checks)) throw assertErr();
  if (anyRule.checks.length === 0) throw assertErr();
  anyRule.checks.forEach(validatePatternCheck);
  return anyRule;
}

function validateBanRules(anyRules: unknown): readonly BanRule[] {
  if (!Array.isArray(anyRules)) throw assertErr();
  anyRules.forEach(validateBanRule);
  return anyRules;
}

function validateContentRules(anyRules: unknown): readonly ContentRule[] {
  if (!Array.isArray(anyRules)) throw assertErr();
  anyRules.forEach(validateContentRule);
  return anyRules;
}

const filePartsGetters = {
  filename: path.basename as (x: string) => string,
  path: (x: string) => x,
  extension: (filename: string) => {
    // Remove leading dot
    return path.extname(filename).slice(1);
  },
};

const regRules = {
  regex(pattern: string) {
    const jsPattern = pattern.replace("\\A", "^").replace("\\z", "$");
    const reg = new RegExp(jsPattern, "i");
    return (str: string) => reg.test(str);
  },
  match(pattern: string) {
    // Assume 'str' is lowercase
    return (str: string) => str === pattern.toLowerCase();
  },
  contains(pattern: string) {
    // Assume 'str' is lowercase
    return (str: string) => str.includes(pattern.toLowerCase());
  },
};

function patternToTester(check: PatternCheck) {
  return {
    check,
    test: regRules[check.type](check.pattern),
  };
}

function ruleToTester(rule: BanRule) {
  const getFilePart = filePartsGetters[rule.part];
  const matcher = regRules[rule.type](rule.pattern);
  return (filename: string) => {
    const part = getFilePart(filename);
    return matcher(part);
  };
}

export const banCheckers = validateBanRules(anyBanRules).map(rule => ({
  rule,
  test: ruleToTester(rule),
}));

export const contentCheckers = validateContentRules(anyContentRules).map(
  rule => ({
    rule,
    test: ruleToTester(rule),
    checks: rule.checks.map(patternToTester),
  })
);
