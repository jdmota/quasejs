import { Graph } from "../../util/graph.ts";
import { never } from "../../util/miscellaneous.ts";
import { type Location } from "../runtime/input.ts";
import { type ToolInput } from "../tool.ts";
import { FollowInfoDB } from "./follow-info.ts";
import {
  type AnyRule,
  type Declaration,
  type ExprRule,
  type FieldRule,
  type RuleDeclaration,
  type RuleDeclarationArg,
  type RuleModifiers,
  type RuleName,
  type TokenDeclaration,
  type TokenModifiers,
  type TokenRules,
  builder,
  cloneRuleDeclaration,
  cloneTokenDeclaration,
} from "./grammar-builder.ts";
import {
  ExternalCallsCollector,
  FieldsCollector,
  ReferencesCollector,
  TokensCollector,
} from "./grammar-visitors.ts";
import { LEXER_RULE_NAME, TokensStore } from "./tokens.ts";
import { type GType } from "./type-checker/types-builder.ts";

export type GrammarError = Readonly<{
  message: string;
  loc: Location | undefined | null;
  loc2: Location | undefined | null;
}>;

export type GrammarResult = Readonly<{
  grammar: Grammar;
  errors: null;
  referencesGraph: Graph<RuleName, null>;
}>;

export type GrammarErrors = Readonly<{
  grammar: null;
  errors: readonly GrammarError[];
}>;

export type GrammarOrErrors = GrammarResult | GrammarErrors;

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

function augmentToolInput({
  name,
  ruleDecls = [],
  tokenDecls = [],
  startArguments = [],
  externalFuncReturns = {},
  maxLL = 3,
  maxFF = 3,
  _useReferenceAnalysis,
}: ToolInput) {
  const augmentedRules = ruleDecls.map(r =>
    augmentRule(cloneRuleDeclaration(r))
  );
  const augmentedTokens = tokenDecls.map(r =>
    augmentToken(cloneTokenDeclaration(r))
  );

  const tokens = new TokensCollector()
    .visitRuleDecls(augmentedRules)
    .visitTokenDecls(augmentedTokens)
    .get();

  const decls = [
    ...augmentedRules,
    tokens.createLexer(),
    ...Array.from(tokens),
  ];

  return {
    name,
    startArguments,
    externalFuncReturns,
    tokens,
    decls,
    maxLL,
    maxFF,
    _useReferenceAnalysis,
  };
}

export const INTERNAL_START_RULE = "$$START$$";

export function createGrammar(options: ToolInput): GrammarOrErrors {
  const errors: GrammarError[] = [];
  const externalCalls = new ExternalCallsCollector();
  const referencesGraph = new Graph<RuleName, null>();

  const {
    name,
    startArguments,
    externalFuncReturns,
    decls,
    tokens,
    maxLL,
    maxFF,
    _useReferenceAnalysis,
  } = augmentToolInput(options);

  // Find start rule
  const startRules = decls.filter(
    (r): r is AugmentedRuleDeclaration =>
      r.type === "rule" && !!r.modifiers.start
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

  const declarations = new Map<string, AugmentedDeclaration>();
  const internalStartRule = augmentRule(
    builder.rule(
      INTERNAL_START_RULE,
      builder.seq(
        builder.field(
          "$$ret",
          builder.call(
            start.name,
            start.args.map(a => builder.id(a.arg))
          )
        ),
        builder.eof()
      ),
      start.args,
      {},
      builder.id("$$ret")
    )
  );
  declarations.set(INTERNAL_START_RULE, internalStartRule);

  // Detect duplicate declarations
  for (const rule of decls) {
    const curr = declarations.get(rule.name);
    if (curr) {
      errors.push(err(`Duplicate rule ${rule.name}`, curr.loc, rule.loc));
    } else {
      declarations.set(rule.name, rule);
    }
  }

  for (const decl of declarations.values()) {
    // Check that normal tokens do not have arguments
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
            // Register in references graph
            if (decl.type === referenced.type) {
              referencesGraph.edge(decl.name, null, referenced.name);
            }

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

  for (const [name, retType] of Object.entries(externalFuncReturns)) {
    if (name.startsWith("$")) {
      errors.push(err(`External functions cannot start with $`, retType.loc));
    }
  }

  // Check that the number of arguments for external calls is consistent
  for (const [name, calls] of externalCalls.get()) {
    if (name.startsWith("$")) continue;

    const funcType = externalFuncReturns[name];
    if (!funcType) {
      errors.push(
        err(
          `No function return type for external function ${name} was found`,
          calls[0].loc
        )
      );
    }

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
    const grammar = new Grammar(
      name,
      declarations,
      tokens,
      internalStartRule,
      startArguments,
      externalFuncReturns,
      maxLL,
      maxFF,
      _useReferenceAnalysis
    );

    return {
      grammar,
      errors: null,
      referencesGraph,
    };
  }

  return {
    grammar: null,
    errors,
  };
}

export class Grammar {
  public readonly name: string;
  public readonly rules: ReadonlyMap<string, AugmentedDeclaration>;
  public readonly tokens: TokensStore;
  public readonly startRule: AugmentedRuleDeclaration;
  public readonly startArguments: readonly GType[];
  public readonly externalFuncReturns: Readonly<Record<string, GType>>;
  public readonly follows: FollowInfoDB;
  public readonly _debugAnalysis: string[] = [];

  constructor(
    name: string,
    rules: ReadonlyMap<string, AugmentedDeclaration>,
    tokens: TokensStore,
    startRule: AugmentedRuleDeclaration,
    startArguments: readonly GType[],
    externalFuncReturns: Readonly<Record<string, GType>>,
    public readonly maxLL: number,
    public readonly maxFF: number,
    public readonly _useReferenceAnalysis: boolean | undefined
  ) {
    this.name = name;
    this.rules = rules;
    this.tokens = tokens;
    this.startRule = startRule;
    this.startArguments = startArguments;
    this.externalFuncReturns = externalFuncReturns;
    this.follows = new FollowInfoDB();
  }

  getRule(ruleName: string) {
    const rule = this.rules.get(ruleName);
    if (rule == null) {
      throw new Error(`Internal error: No rule called ${ruleName}`);
    }
    return rule;
  }

  tokenId(token: TokenRules | AugmentedTokenDeclaration) {
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
      const token = this.tokenIdToDecl(num);
      return token ? token.name : `${num}`;
    }
  }
}

export type AugmentedDeclaration =
  | AugmentedRuleDeclaration
  | AugmentedTokenDeclaration;

export type AugmentedRuleDeclaration = {
  readonly type: "rule";
  readonly name: string;
  readonly rule: AnyRule;
  readonly args: readonly RuleDeclarationArg[];
  readonly return: ExprRule;
  readonly modifiers: RuleModifiers;
  readonly fields: ReadonlyMap<string, FieldRule[]>;
  loc: Location | null;
};

function augmentRule(rule: RuleDeclaration): AugmentedRuleDeclaration {
  const loc = needsLoc(rule);
  const body = augmentRuleBody(rule.rule, loc);
  const fields = new FieldsCollector().run(body);
  const ret = augmentReturn(rule.return, loc, fields);
  return {
    type: "rule",
    name: rule.name,
    rule: body,
    args: rule.args,
    modifiers: rule.modifiers,
    return: ret,
    fields,
    loc: rule.loc,
  };
}

export type AugmentedTokenDeclaration = {
  readonly type: "token";
  readonly name: string;
  readonly rule: AnyRule;
  readonly args: readonly RuleDeclarationArg[];
  readonly return: ExprRule;
  readonly modifiers: TokenModifiers;
  readonly fields: ReadonlyMap<string, FieldRule[]>;
  loc: Location | null;
};

export function augmentToken(
  rule: TokenDeclaration
): AugmentedTokenDeclaration {
  const loc = needsLoc(rule);
  const body = augmentRuleBody(rule.rule, loc);
  const fields = new FieldsCollector().run(body);
  const ret = augmentReturn(rule.return, loc, fields);
  return {
    type: "token",
    name: rule.name,
    rule: body,
    args: rule.args,
    modifiers: rule.modifiers,
    return: ret,
    fields,
    loc: rule.loc,
  };
}

function needsLoc(rule: Declaration) {
  return (
    rule.type === "rule" ||
    (rule.type === "token" && rule.name === LEXER_RULE_NAME)
  );
}

function augmentRuleBody(rule: AnyRule, withLoc: boolean) {
  return withLoc
    ? builder.seq(
        builder.field("$startPos", builder.call2("$getPos", [])),
        rule,
        builder.field(
          "$loc",
          builder.call2("$getLoc", [builder.id("$startPos")])
        )
      )
    : rule;
}

function augmentReturn(
  ret: ExprRule | null,
  withLoc: boolean,
  fields: ReadonlyMap<string, FieldRule[]>
) {
  if (withLoc) {
    if (ret) {
      if (ret.type === "object") {
        return builder.object([...ret.fields, ["$loc", builder.id("$loc")]]);
      }
      return ret;
    }
    return builder.object(
      Array.from(fields.keys())
        .filter(f => !f.startsWith("$") || f === "$loc")
        .map(f => [f, builder.id(f)])
    );
  }
  return (
    ret ??
    builder.object(
      Array.from(fields.keys())
        .filter(f => !f.startsWith("$"))
        .map(f => [f, builder.id(f)])
    )
  );
}
