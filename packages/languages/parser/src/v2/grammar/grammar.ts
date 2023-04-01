import { Location } from "../runtime/input";
import { never } from "../utils";
import {
  Declaration,
  RuleDeclaration,
  RuleDeclarationArg,
  TokenDeclaration,
  TokenRules,
} from "./grammar-builder";
import {
  ExternalCallsCollector,
  ReferencesCollector,
  TokensCollector,
} from "./grammar-visitors";
import { TokensStore } from "./tokens";

export type GrammarError = Readonly<{
  message: string;
  loc: Location | undefined | null;
  loc2: Location | undefined | null;
}>;

type GrammarOrErrors =
  | Readonly<{
      grammar: Grammar;
      errors: null;
    }>
  | Readonly<{
      grammar: null;
      errors: readonly GrammarError[];
    }>;

export function err(
  message: string,
  loc: Location | undefined | null,
  loc2: Location | undefined | null = null
): GrammarError {
  return {
    message,
    loc,
    loc2,
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
  const externalCalls = new ExternalCallsCollector();

  // Detect duplicate rules
  const rules = new Map<string, Declaration>();
  for (const rule of decls) {
    const curr = rules.get(rule.name);
    if (curr) {
      errors.push(err(`Duplicate rule ${rule.name}`, curr.loc, rule.loc));
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
    externalCalls.visitDecl(decl);

    if (decl.type === "rule") {
      // Detect duplicate arguments in rules
      const seenArgs = new Map<string, RuleDeclarationArg>();
      for (const arg of decl.args) {
        const seenArg = seenArgs.get(arg.arg);
        if (seenArg) {
          errors.push(
            err(
              `Duplicate argument ${arg.arg} in declaration ${decl.name}`,
              seenArg.loc,
              arg.loc
            )
          );
        } else {
          seenArgs.set(arg.arg, arg);
        }
      }

      // Detect conflicts between arguments and fields
      for (const [name, fields] of decl.fields) {
        const seenArg = seenArgs.get(name);
        if (seenArg) {
          errors.push(
            err(
              `Field cannot have the same name as argument`,
              seenArg.loc,
              fields[0].loc
            )
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

    const references = new ReferencesCollector().visitDecl(decl).get();
    for (const ref of references) {
      const id = ref.id;
      switch (ref.type) {
        case "call":
          const referenced = rules.get(id);
          // Detect undefined references
          if (!referenced) {
            errors.push(err(`Cannot find rule ${id}`, ref.loc));
          } else {
            // Detect wrong number of arguments
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

  // Check that the number of arguments for external calls is consistent
  for (const [name, calls] of externalCalls.get()) {
    let firstCall = null;
    for (const call of calls) {
      if (firstCall) {
        if (firstCall.args.length !== call.args.length) {
          errors.push(
            err(
              `Cannot infer number of arguments for external call ${name}`,
              firstCall.loc,
              call.loc
            )
          );
          break;
        }
      } else {
        firstCall = call;
      }
    }
  }

  if (errors.length === 0) {
    const grammar = new Grammar(name, rules, tokens, startRules[0]);

    return {
      grammar,
      errors: null,
    };
  }

  return {
    grammar: null,
    errors,
  };
}

export class Grammar {
  public readonly name: string;
  public readonly rules: ReadonlyMap<string, Declaration>;
  public readonly tokens: TokensStore;
  public readonly startRule: RuleDeclaration;

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

  tokenIdToDecl(id: number) {
    return this.tokens.getDecl(id);
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

  getDecls() {
    return this.rules.values();
  }

  userFriendlyName(num: number, inLexer: boolean) {
    if (inLexer) {
      return num < 0 ? `${num}` : `'${String.fromCodePoint(num)}'`;
    } else {
      return this.tokenIdToDecl(num).name;
    }
  }
}
