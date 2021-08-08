import { Location } from "../runtime/input";
import { locSuffix, locSuffix2, never } from "../utils";
import {
  Declaration,
  FieldRule,
  RuleDeclaration,
  TokenDeclaration,
  TokenRules,
} from "./grammar-builder";
import { ReferencesCollector, TokensCollector } from "./grammar-visitors";
import { TokensStore } from "./tokens";
import { TypesInferrer } from "./type-checker/inferrer";

export type GrammarError = Readonly<{
  message: string;
  loc: Location | null;
}>;

type GrammarOrErrors =
  | Readonly<{ grammar: Grammar; errors: null }>
  | Readonly<{ grammar: null; errors: readonly GrammarError[] }>;

export function err(message: string, loc: Location | null): GrammarError {
  return {
    message,
    loc,
  };
}

export function createGrammar(
  name: string,
  ruleDecls: readonly RuleDeclaration[],
  tokenDecls: readonly TokenDeclaration[]
): GrammarOrErrors {
  const errors: GrammarError[] = [];
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
        err(`Duplicate rule ${rule.name}${locSuffix(curr.loc)}`, rule.loc)
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
    errors.push(err(`Expected 1 start rule, found ${startRules.length}`, null));
  }

  // For each declaration...
  for (const decl of rules.values()) {
    if (decl.type === "rule") {
      // Detect duplicate arguments in rules
      const seenArgs = new Set<string>();
      for (const { arg } of decl.args) {
        if (seenArgs.has(arg)) {
          errors.push(
            err(
              `Duplicate argument ${arg} in declaration ${decl.name}`,
              decl.loc
            )
          );
        } else {
          seenArgs.add(arg);
        }
      }

      // Detect conflicts between arguments and fields
      for (const [name, fields] of decl.fields) {
        if (seenArgs.has(name)) {
          errors.push(
            err(`Conflict between argument and field`, fields[0].loc)
          );
        }
      }
    }

    // Detect ambiguity between single value fields or array fields
    for (const [name, fields] of decl.fields) {
      let multiple: boolean | null = null;
      for (const field of fields) {
        if (multiple == null) {
          multiple = field.multiple;
        } else if (field.multiple != multiple) {
          errors.push(
            err(
              `Field ${name} must be an array or a single value, not both`,
              decl.loc
            )
          );
          break;
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
            errors.push(err(`Cannot find rule ${id}`, ref.loc));
          } else {
            const expected =
              referenced.type === "rule" ? referenced.args.length : 0;
            if (expected !== ref.args.length) {
              errors.push(
                err(
                  `${id} expected ${expected} arguments but got ${ref.args.length}`,
                  ref.loc
                )
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
                  err(
                    `Cannot reference token ${id} with type "${referenced.modifiers.type}" from rule declaration`,
                    ref.loc
                  )
                );
              }
            } else {
              if (referenced.type === "rule") {
                errors.push(
                  err(`Cannot reference rule ${id} from token rule`, ref.loc)
                );
              }
            }
          }
          break;
        case "id":
          if (
            !decl.fields.has(id) &&
            (decl.type === "token" || !decl.args.find(a => a.arg === id))
          ) {
            errors.push(err(`Cannot find variable ${id}`, ref.loc));
          }
          break;
        default:
          never(ref);
      }
    }
  }

  if (errors.length === 0) {
    const infer = new TypesInferrer();
    for (const rule of rules.values()) {
      if (rule.type === "rule") {
        infer.run(rule);
      }
      // TODO for token rules
    }
    infer.check(errors);
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
