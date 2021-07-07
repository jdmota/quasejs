import { locSuffix, locSuffix2, never } from "../utils";
import { Declaration, RuleDeclaration } from "./grammar-builder";
import {
  ReferencesCollector,
  TokensCollector,
  Locals,
  LocalsCollector,
} from "./grammar-visitors";
import { TokensStore } from "./tokens";

type GrammarOrError =
  | { grammar: Grammar; errors: null }
  | { grammar: null; errors: string[] };

export function createGrammar(
  name: string,
  decls: readonly Declaration[]
): GrammarOrError {
  const errors = [];

  // Detect duplicate rules
  const rules = new Map<string, { decl: Declaration; locals: Locals }>();
  for (const rule of decls) {
    const curr = rules.get(rule.name);
    if (curr) {
      errors.push(
        `Duplicate rule ${rule.name}${locSuffix2(curr.decl.loc, rule.loc)}`
      );
    } else {
      rules.set(rule.name, {
        decl: rule,
        locals: new LocalsCollector().run([rule]),
      });
    }
  }

  // Find start rule
  const startRules = decls.filter(
    (r): r is RuleDeclaration => r.type === "rule" && !!r.modifiers.start
  );
  if (startRules.length !== 1) {
    errors.push(`Expected 1 start rule, found ${startRules.length}`);
  }

  // For each declaration...
  for (const { decl, locals } of rules.values()) {
    // Detect undefined references
    const references = new ReferencesCollector().run([decl]);
    for (const ref of references) {
      const id = ref.id;
      const isLocal = locals.has(id);
      switch (ref.type) {
        case "call":
          if (isLocal) {
            errors.push(`${id} is a variable here, not a rule`);
          } else if (!rules.has(id)) {
            errors.push(`Cannot find rule ${id}${locSuffix(ref.loc)}`);
          }
          break;
        case "id":
          if (!isLocal && !rules.has(id)) {
            errors.push(
              `Cannot find rule or variable ${id}${locSuffix(ref.loc)}`
            );
          }
          break;
        default:
          never(ref);
      }
    }

    // Detect duplicate arguments
    const seenArgs = new Set<string>();
    for (const arg of decl.args) {
      if (seenArgs.has(arg)) {
        errors.push(
          `Duplicate argument ${arg} in declaration ${decl.name}${locSuffix(
            decl.loc
          )}`
        );
      } else {
        seenArgs.add(arg);
      }
    }
  }

  if (errors.length === 0) {
    const tokens = new TokensCollector().run(decls);
    const startRule = startRules[0];

    return {
      grammar: new Grammar(name, rules, tokens, startRule),
      errors: null,
    };
  }
  return {
    grammar: null,
    errors,
  };
}

export class Grammar {
  readonly name: string;
  readonly rules: ReadonlyMap<string, { decl: Declaration; locals: Locals }>;
  readonly tokens: TokensStore;
  readonly startRule: RuleDeclaration;

  constructor(
    name: string,
    rules: ReadonlyMap<string, { decl: Declaration; locals: Locals }>,
    tokens: TokensStore,
    startRule: RuleDeclaration
  ) {
    this.name = name;
    this.rules = rules;
    this.tokens = tokens;
    this.startRule = startRule;
  }

  getRule(ruleName: string) {
    const rule = this.rules.get(ruleName);
    if (rule == null) {
      throw new Error(`Internal error: No rule called ${ruleName}`);
    }
    return rule;
  }
}
