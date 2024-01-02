import { Location } from "../runtime/input";
import { ToolInput } from "../tool";
import { never } from "../utils";
import {
  Declaration,
  RuleDeclaration,
  RuleDeclarationArg,
  TokenDeclaration,
  TokenRules,
  cloneDeclaration,
} from "./grammar-builder";
import {
  ExternalCallsCollector,
  ReferencesCollector,
  TokensCollector,
} from "./grammar-visitors";
import { TokensStore } from "./tokens";
import { GFuncType, GType } from "./type-checker/types-builder";

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

export function createGrammar({
  name,
  ruleDecls,
  tokenDecls,
  startArguments,
  externalFunctions,
}: ToolInput): GrammarOrErrors {
  const errors: GrammarError[] = [];
  const tokens = new TokensCollector()
    .visitRuleDecls(ruleDecls)
    .visitTokenDecls(tokenDecls)
    .get();
  const lexer = tokens.createLexer();
  const decls = [...ruleDecls, lexer, ...Array.from(tokens)].map(r =>
    cloneDeclaration(r)
  );
  const externalCalls = new ExternalCallsCollector();

  // Detect duplicate rules
  const declarations = new Map<string, Declaration>();
  for (const rule of decls) {
    const curr = declarations.get(rule.name);
    if (curr) {
      errors.push(err(`Duplicate rule ${rule.name}`, curr.loc, rule.loc));
    } else {
      declarations.set(rule.name, rule);
    }
  }

  // Find start rule
  const startRules = decls.filter(
    (r): r is RuleDeclaration => r.type === "rule" && !!r.modifiers.start
  );
  if (startRules.length !== 1) {
    errors.push(err(`Expected 1 start rule, found ${startRules.length}`, null));
  }

  const start = startRules[0];
  if (start.args.length !== startArguments.length) {
    errors.push(
      err(
        `Missing types for start rule arguments. Expected ${start.args.length}, found ${startArguments.length}.`,
        start.loc
      )
    );
  }

  // Check that normal tokens do not have arguments
  for (const decl of declarations.values()) {
    if (
      decl.args.length > 0 &&
      decl.type === "token" &&
      decl.modifiers.type === "normal"
    ) {
      errors.push(err(`Normal tokens should not have arguments`, decl.loc));
    }
  }

  // For each declaration...
  for (const decl of declarations.values()) {
    externalCalls.visitDecl(decl);

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
          const referenced = declarations.get(id);
          // Detect undefined references
          if (!referenced) {
            errors.push(err(`Cannot find rule ${id}`, ref.loc));
          } else {
            // Detect wrong number of arguments
            const expected = referenced.args.length;
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
          if (!decl.fields.has(id) && !decl.args.find(a => a.arg === id)) {
            errors.push(err(`Cannot find variable ${id}`, ref.loc));
          }
          break;
        default:
          never(ref);
      }
    }
  }

  for (const [name, funcType] of Object.entries(externalFunctions)) {
    if (name.startsWith("$")) {
      errors.push(err(`External functions cannot start with $`, funcType.loc));
    } else if (funcType.type !== "func") {
      errors.push(
        err(
          `Type for external function ${name} should be a function type`,
          funcType.loc
        )
      );
    }
  }

  // Check that the number of arguments for external calls is consistent
  for (const [name, calls] of externalCalls.get()) {
    if (name.startsWith("$")) continue;

    const funcType = externalFunctions[name];
    if (funcType) {
      for (const call of calls) {
        if (funcType.args.length !== call.args.length) {
          errors.push(
            err(
              `Expected ${funcType.args.length} arguments but got ${call.args.length}`,
              call.loc,
              funcType.loc
            )
          );
          break;
        }
      }
    } else {
      errors.push(
        err(
          `No function type for external function ${name} was found`,
          calls[0].loc
        )
      );
    }
    /*let firstCall = null;
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
    }*/
  }

  if (errors.length === 0) {
    const grammar = new Grammar(
      name,
      declarations,
      tokens,
      start,
      startArguments,
      externalFunctions
    );

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
  public readonly startArguments: readonly GType[];
  public readonly externalFunctions: Readonly<Record<string, GFuncType>>;

  constructor(
    name: string,
    rules: ReadonlyMap<string, Declaration>,
    tokens: TokensStore,
    startRule: RuleDeclaration,
    startArguments: readonly GType[],
    externalFunctions: Readonly<Record<string, GFuncType>>
  ) {
    this.name = name;
    this.rules = rules;
    this.tokens = tokens;
    this.startRule = startRule;
    this.startArguments = startArguments;
    this.externalFunctions = externalFunctions;
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
