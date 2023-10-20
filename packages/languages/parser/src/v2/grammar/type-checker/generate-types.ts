import { Grammar } from "../grammar";
import {
  RuleDeclInterface,
  TokenDeclInterface,
  TypesInferrer,
} from "./inferrer";
import { AnyNormalizedType } from "./normalizer";
import { never } from "../../utils";
import { RuleDeclaration, TokenDeclaration } from "../grammar-builder";
import { isTSType, runtimeTypes } from "./types";
import { LEXER_RULE_NAME } from "../tokens";

function toTypescript(
  type: AnyNormalizedType,
  names: Names,
  nameContext: string
): string {
  const possibleName = names.peek(type);
  if (possibleName && nameContext !== possibleName) {
    return possibleName;
  }
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
        .map((a, i) => `arg${i}: ${toTypescript(a, names, nameContext)}`)
        .join(", ")}) => ${toTypescript(type.ret, names, nameContext)})`;
    case "ReadonlyObjectType":
      if (type.fields.length === 0) {
        return "Readonly<Record<string, never>>";
      }
      return `Readonly<{ ${type.fields
        .map(([k, v]) => `${k}: ${toTypescript(v, names, nameContext)}`)
        .join(", ")} }>`;
    case "ReadonlyArrayType":
      return `readonly ${toTypescript(type.component, names, nameContext)}[]`;
    case "ArrayType":
      return `${toTypescript(type.component, names, nameContext)}[]`;
    case "UnionType":
      return `(${Array.from(type.types)
        .map(t => toTypescript(t, names, nameContext))
        .join(" | ")})`;
    case "IntersectionType":
      return `(${Array.from(type.types)
        .map(t => toTypescript(t, names, nameContext))
        .join(" & ")})`;
    case "RecursiveRef":
      return names.get(type.get());
    case "GenericType":
      const lower = toTypescript(type.lower, names, nameContext);
      const upper = toTypescript(type.upper, names, nameContext);
      return `T${type.id} /* [${lower}; ${upper}] */`;
    default:
      never(type);
  }
}

class Names {
  private names = new Map<AnyNormalizedType, string>();
  private declarations: Readonly<{
    type: AnyNormalizedType;
    name: string;
    expr: string | null;
  }>[] = [];
  private uuid = 1;

  peek(type: AnyNormalizedType) {
    return this.names.get(type);
  }

  get(type: AnyNormalizedType) {
    let name = this.names.get(type);
    if (name == null) {
      name = `$rec${this.uuid++}`;
      this.names.set(type, name);
      this.declarations.push({ type, name, expr: null });
    }
    return name;
  }

  set(type: AnyNormalizedType, proposal: string, declare: boolean) {
    let name = this.names.get(type);
    if (name == null) {
      name = proposal;
      this.names.set(type, name);
      if (declare) this.declarations.push({ type, name, expr: null });
    } else {
      if (declare) this.declarations.push({ type, name: proposal, expr: name });
    }
  }

  [Symbol.iterator]() {
    return this.declarations.values();
  }
}

// TODO need minimization on intersections
// TODO better choose generic types, we cannot just choose the lower bound...

export function generateTypes(grammar: Grammar, inferrer: TypesInferrer) {
  inferrer.registry.propagatePolarities();

  const lines = [`/* eslint-disable */`];

  const normalizer = inferrer.normalizer;
  const names = new Names();

  for (const [key, value] of Object.entries(runtimeTypes)) {
    names.set(normalizer.normalize(value), key, !isTSType(value));
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
        normalizer.normalize(funcType),
        names,
        "$ExternalCalls"
      )};`
    );
  }
  lines.push(`};`);

  for (const { type, name, expr } of names) {
    lines.push(
      `export type ${name} = ${expr ?? toTypescript(type, names, name)};`
    );
  }

  lines.push(``);
  return lines.join(`\n`);

  function forEachDecl(
    { argTypes, returnType }: RuleDeclInterface | TokenDeclInterface,
    rule: RuleDeclaration | TokenDeclaration,
    allNames: string[]
  ) {
    const normalizedArgs = Array.from(argTypes).map(
      ([name, type]) => [name, normalizer.normalize(type)] as const
    );
    const normalizedReturn = normalizer.normalize(returnType);

    normalizedArgs.forEach(([name, type]) =>
      names.set(type, `${rule.name}_${name}`, true)
    );
    names.set(normalizedReturn, rule.name, true);

    if (rule.name !== LEXER_RULE_NAME) {
      allNames.push(rule.name);
    }
  }
}
