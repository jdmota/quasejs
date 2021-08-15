import { Grammar } from "../grammar/grammar";
import { TypesInferrer } from "../grammar/type-checker/inferrer";
import { AnyNormalizedType } from "../grammar/type-checker/normalizer";
import { never, nonNull } from "../utils";

function toTypescript(
  type: AnyNormalizedType,
  names: ReadonlyMap<AnyNormalizedType, string>
): string {
  switch (type.clazz) {
    case "TopType":
      return "unknown";
    case "StringType":
      return "string";
    case "IntType":
      return "int";
    case "NullType":
      return "null";
    case "BooleanType":
      return "boolean";
    case "BottomType":
      return "never";
    case "ReadonlyObjectType":
      if (type.fields.length === 0) {
        return "Readonly<Record<string, never>>";
      }
      return `Readonly<{ ${type.fields
        .map(([k, v]) => `${k}: ${toTypescript(v, names)}`)
        .join(", ")} }>`;
    case "ReadonlyArrayType":
      return `readonly ${toTypescript(type.component, names)}[]`;
    case "ArrayType":
      return `${toTypescript(type.component, names)}[]`;
    case "UnionType":
      return `(${Array.from(type.types)
        .map(t => toTypescript(t, names))
        .join(" | ")})`;
    case "IntersectionType":
      return `(${Array.from(type.types)
        .map(t => toTypescript(t, names))
        .join(" & ")})`;
    case "RecursiveRef":
      return nonNull(names.get(type.get()));
    default:
      never(type);
  }
}

export function generateTypes(grammar: Grammar, inferrer: TypesInferrer) {
  const lines = [
    `/* eslint-disable */`,
    `export type $Position = {pos:number;line:number;column:number;};`,
    `export type $Location = {start:$Position;end:$Position;};`,
  ];

  const { lower } = inferrer.normalizer;
  const names = new Map<AnyNormalizedType, string>();
  const astNodes = [];

  for (const [rule, { argTypes, returnType }] of inferrer.getRuleInterfaces()) {
    const normalizedArgs = Array.from(argTypes).map(
      ([name, type]) => [name, lower.normalize(type)] as const
    );
    const normalizedReturn = lower.normalize(returnType);

    normalizedArgs.forEach(([name, type]) =>
      names.set(type, `${rule.name}_${name}`)
    );
    names.set(normalizedReturn, rule.name);
    astNodes.push(rule.name);
  }

  let recRefId = 1;
  for (const recRef of lower.getUsedRecursiveRefs()) {
    names.set(recRef.get(), `$rec${recRefId++}`);
  }

  for (const [type, name] of names) {
    lines.push(`export type ${name} = ${toTypescript(type, names)};`);
  }

  lines.push(`export type $Nodes = ${astNodes.join("|")};`);

  lines.push(`export type $ExternalCalls = {`);
  for (const [
    callName,
    { argTypes, returnType },
  ] of inferrer.getExternalCallInterfaces()) {
    const normalizedArgs = argTypes.map(type => lower.normalize(type));
    const normalizedReturn = lower.normalize(returnType);

    lines.push(
      `  ${callName}: (${normalizedArgs.map(
        (type, i) => `a${i}: ${toTypescript(type, names)}`
      )}) => ${toTypescript(normalizedReturn, names)};`
    );
  }
  lines.push(`};`);

  // TODO token rules

  lines.push(``);
  return lines.join(`\n`);
}
