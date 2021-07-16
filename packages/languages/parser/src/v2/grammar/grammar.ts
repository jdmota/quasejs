import { locSuffix, locSuffix2, never } from "../utils";
import {
  Declaration,
  RuleDeclaration,
  TokenDeclaration,
  TokenRules,
} from "./grammar-builder";
import { ReferencesCollector, TokensCollector } from "./grammar-visitors";
import { TokensStore } from "./tokens";

type GrammarOrError =
  | { grammar: Grammar; errors: null }
  | { grammar: null; errors: string[] };

export function createGrammar(
  name: string,
  ruleDecls: readonly RuleDeclaration[],
  tokenDecls: readonly TokenDeclaration[]
): GrammarOrError {
  const errors = [];
  const tokens = new TokensCollector()
    .visitRuleDecls(ruleDecls)
    .visitTokenDecls(tokenDecls)
    .get();
  const lexer = tokens.createLexer();
  const decls = [...ruleDecls, lexer, ...Array.from(tokens)];

  // Detect duplicate rules
  const rules = new Map<string, Declaration>();
  for (const rule of decls) {
    const curr = rules.get(rule.name);
    if (curr) {
      errors.push(
        `Duplicate rule ${rule.name}${locSuffix2(curr.loc, rule.loc)}`
      );
    } else {
      rules.set(rule.name, rule);
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
  for (const decl of rules.values()) {
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
    const references = new ReferencesCollector().visitDecl(decl).get();
    for (const ref of references) {
      const id = ref.id;
      switch (ref.type) {
        case "call":
          const referenced = rules.get(id);
          if (!referenced) {
            errors.push(`Cannot find rule ${id}${locSuffix(ref.loc)}`);
          } else {
            const expected =
              referenced.type === "rule" ? referenced.args.length : 0;
            if (expected !== ref.args.length) {
              errors.push(
                `${id} expected ${expected} arguments but got ${
                  ref.args.length
                }${locSuffix(ref.loc)}`
              );
            }

            // Detect if we are referencing a fragment/skip token from a rule declaration
            // or a rule from a token declaration
            if (decl.type === "rule") {
              if (
                referenced.type === "token" &&
                referenced.modifiers.type !== "normal"
              ) {
                errors.push(
                  `Cannot reference token ${id} with type "${
                    referenced.modifiers.type
                  }" from rule declaration${locSuffix(ref.loc)}`
                );
              }
            } else {
              if (referenced.type === "rule") {
                errors.push(
                  `Cannot reference rule ${id} from token rule${locSuffix(
                    ref.loc
                  )}`
                );
              }
            }
          }
          break;
        case "id":
          if (
            !decl.locals.includes(id) &&
            (decl.type === "token" || !decl.args.includes(id))
          ) {
            errors.push(`Cannot find variable ${id}${locSuffix(ref.loc)}`);
          }
          break;
        default:
          never(ref);
      }
    }
  }

  if (errors.length === 0) {
    return {
      grammar: new Grammar(name, rules, tokens, startRules[0]),
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
  private readonly rules: ReadonlyMap<string, Declaration>;
  private readonly tokens: TokensStore;
  private readonly startRule: RuleDeclaration;

  constructor(
    name: string,
    rules: ReadonlyMap<string, Declaration>,
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

  *getRules() {
    for (const decl of this.rules.values()) {
      if (decl.type === "rule") {
        yield decl;
      }
    }
  }

  *getTokens() {
    for (const decl of this.rules.values()) {
      if (decl.type === "token") {
        yield decl;
      }
    }
  }
}
