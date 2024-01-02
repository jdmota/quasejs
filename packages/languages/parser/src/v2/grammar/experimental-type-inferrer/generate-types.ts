import { Grammar } from "../grammar";
import {
  RuleDeclInterface,
  TokenDeclInterface,
  TypesInferrer,
} from "./inferrer";
import { AnyNormalizedType } from "./normalizer";
import { never } from "../../utils";
import { RuleDeclaration, TokenDeclaration } from "../grammar-builder";
import { formatPolarity, isAtomType, runtimeTypes } from "./types";
import { LEXER_RULE_NAME } from "../tokens";

function toTypescript(
  type: AnyNormalizedType,
  namesNeeded: Set<string>,
  inComment = false
): string {
  switch (type.clazz) {
    case "TopType":
      return "unknown";
    case "StringType":
      return "string";
    case "IntType":
      return "number";
    case "NullType":
      return "null";
    case "BooleanType":
      return "boolean";
    case "BottomType":
      return "never";
    case "FunctionType":
      return `((${type.args
        .map((a, i) => `arg${i}: ${toTypescript(a, namesNeeded, inComment)}`)
        .join(", ")}) => ${toTypescript(type.ret, namesNeeded, inComment)})`;
    case "ReadonlyObjectType":
      if (type.fields.length === 0) {
        return "Readonly<Record<string, never>>";
      }
      return `Readonly<{ ${type.fields
        .map(([k, v]) => `${k}: ${toTypescript(v, namesNeeded, inComment)}`)
        .join(", ")} }>`;
    case "ReadonlyArrayType":
      return `readonly ${toTypescript(
        type.component,
        namesNeeded,
        inComment
      )}[]`;
    case "ArrayType":
      return `${toTypescript(type.component, namesNeeded, inComment)}[]`;
    case "UnionType":
      return `(${Array.from(type.types)
        .map(t => toTypescript(t, namesNeeded, inComment))
        .join(" | ")})`;
    case "IntersectionType":
      return `(${Array.from(type.types)
        .map(t => toTypescript(t, namesNeeded, inComment))
        .join(" & ")})`;
    case "RecursiveRef":
      throw new Error("nope");
    case "GenericType":
      const lower = toTypescript(type.lower, namesNeeded, true);
      const upper = toTypescript(type.upper, namesNeeded, true);
      return `${"null" ?? type.name} ${
        inComment ? "[*" : "/*"
      } ${formatPolarity(type.polarity)} [${lower}; ${upper}] ${
        inComment ? "*]" : "*/"
      }`;
    case "AliasType":
      namesNeeded.add(type.name);
      return type.name;
    default:
      never(type);
  }
}

export function generateTypes(grammar: Grammar, inferrer: TypesInferrer) {
  inferrer.registry.propagatePolarities();

  const lines = [`/* eslint-disable */`];
  const namesNeeded: Set<string> = new Set();
  const toPrint: Set<string> = new Set();

  const normalizer = inferrer.normalizer;

  for (const runtimeType of Object.values(runtimeTypes)) {
    normalizer.normalize2(runtimeType);
    if (!isAtomType(runtimeType)) {
      toPrint.add(runtimeType.ensureName());
    }
  }

  const astNodes: string[] = [];
  const astTokens: string[] = [];

  for (const [rule, inter] of inferrer.getRuleInterfaces()) {
    forEachDecl(inter, rule, astNodes);
  }

  for (const [rule, inter] of inferrer.getTokenInterfaces()) {
    forEachDecl(inter, rule, astTokens);
  }

  lines.push(`export type $Nodes = ${astNodes.join("|")};`);
  lines.push(`export type $Tokens = ${astTokens.join("|")};`);

  lines.push(`export type $ExternalCalls = {`);
  for (const [callName, funcType] of inferrer.getExternalCallInterfaces()) {
    lines.push(
      `  ${callName}: ${toTypescript(
        normalizer.normalize2(funcType),
        namesNeeded
      )};`
    );
  }
  lines.push(`};`);

  for (const name of toPrint) {
    lines.push(
      `export type ${name} = ${toTypescript(
        normalizer.getFromCache(name),
        namesNeeded
      )};`
    );
  }

  for (const name of namesNeeded) {
    if (!toPrint.has(name)) {
      lines.push(
        `export type ${name} = ${toTypescript(
          normalizer.getFromCache(name),
          namesNeeded
        )};`
      );
    }
  }

  lines.push(``);
  return lines.join(`\n`);

  function forEachDecl(
    { argTypes, returnType }: RuleDeclInterface | TokenDeclInterface,
    rule: RuleDeclaration | TokenDeclaration,
    allNames: string[]
  ) {
    for (const [_, type] of argTypes) {
      normalizer.normalize2(type);
      toPrint.add(type.ensureName());
    }

    normalizer.normalize2(returnType);
    toPrint.add(returnType.ensureName());

    if (rule.name !== LEXER_RULE_NAME) {
      allNames.push(rule.name);
    }
  }
}
