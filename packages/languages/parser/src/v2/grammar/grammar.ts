import { locSuffix, locSuffix2, never } from "../utils";
import {
  Declaration,
  RuleDeclaration,
  TokenDeclaration,
  TokenRules,
} from "./grammar-builder";
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
    // Detect duplicate arguments in rules
    if (decl.type === "rule") {
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

    // Detect undefined references and wrong number of arguments
    const references = new ReferencesCollector().run([decl]);
    for (const ref of references) {
      const id = ref.id;
      const isLocal = locals.has(id);
      const referenced = rules.get(id);
      switch (ref.type) {
        case "call":
          if (isLocal) {
            errors.push(`${id} is a variable here, not a rule`);
          } else if (!referenced) {
            errors.push(`Cannot find rule ${id}${locSuffix(ref.loc)}`);
          } else {
            const expected =
              referenced.decl.type === "rule" ? referenced.decl.args.length : 0;
            if (expected !== ref.args.length) {
              errors.push(
                `${id} expected ${expected} arguments but got ${
                  ref.args.length
                }${locSuffix(ref.loc)}`
              );
            }
          }
          break;
        case "id":
          if (!isLocal && !referenced) {
            errors.push(
              `Cannot find rule, token or variable ${id}${locSuffix(ref.loc)}`
            );
          }
          break;
        default:
          never(ref);
      }
      // Detect if we are referencing a fragment/skip token from a rule declaration
      // or a rule from a token declaration
      if (!isLocal && referenced) {
        if (decl.type === "rule") {
          if (
            referenced.decl.type === "token" &&
            referenced.decl.modifiers.type !== "normal"
          ) {
            errors.push(
              `Cannot reference token ${id} with type "${
                referenced.decl.modifiers.type
              }" from rule declaration${locSuffix(ref.loc)}`
            );
          }
        } else {
          if (referenced.decl.type === "rule") {
            errors.push(
              `Cannot reference rule ${id} from token rule${locSuffix(ref.loc)}`
            );
          }
        }
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
  private readonly name: string;
  private readonly rules: ReadonlyMap<
    string,
    { decl: Declaration; locals: Locals }
  >;
  private readonly tokens: TokensStore;
  private readonly startRule: RuleDeclaration;

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

  getStart() {
    return this.startRule;
  }

  getRule(ruleName: string) {
    const rule = this.rules.get(ruleName);
    if (rule == null) {
      throw new Error(`Internal error: No rule called ${ruleName}`);
    }
    return rule;
  }

  tokenId(token: TokenRules | TokenDeclaration) {
    return this.tokens.get(token);
  }

  resolve(decl: Declaration, id: string): ResolvedId {
    const { locals } = this.getRule(decl.name);
    if (locals.has(id)) {
      return { type: "local", decl: null };
    }
    const referenced = this.getRule(id);
    if (referenced.decl.type === "rule") {
      return { type: "rule", decl: referenced.decl };
    }
    return { type: "token", decl: referenced.decl };
  }

  *getRules() {
    for (const { decl } of this.rules.values()) {
      if (decl.type === "rule") {
        yield decl;
      }
    }
  }

  *getTokens() {
    for (const token of this.tokens) {
      yield token;
    }
  }
}

type ResolvedId =
  | {
      readonly type: "local";
      readonly decl: null;
    }
  | {
      readonly type: "rule";
      readonly decl: RuleDeclaration;
    }
  | {
      readonly type: "token";
      readonly decl: TokenDeclaration;
    };
