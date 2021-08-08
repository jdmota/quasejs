import { Grammar } from "../grammar/grammar";
import { AnyNormalizedType } from "../grammar/type-checker/normalizer";
import { never, nonNull } from "../utils";

/*function generateFieldType({
  fields,
  optional,
  multiple,
}: ReadonlyFieldStoreValue) {
  const baseType = ``; // TODO
  return multiple
    ? baseType.includes("|")
      ? `(${baseType})[]`
      : `${baseType}[]`
    : optional
    ? `${baseType}|null`
    : baseType;
}*/

/*function generateRuleType(
  grammar: Grammar,
  name: string,
  store: ReadonlyFieldsStore
) {
  const fields = Array.from(store).map(
    field => `  ${field.name}: ${generateFieldType(field)};`
  );
  return {
    typeName: name,
    typeDefinition: [
      `{`,
      `  $type: "${name}";`,
      `  $loc: $Location;`,
      ...fields,
      `}`,
    ].join("\n"),
  };
}*/

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

export function generateTypes(grammar: Grammar) {
  const lines = [
    `/* eslint-disable */`,
    `export type $Position = {pos:number;line:number;column:number;};`,
    `export type $Location = {start:$Position;end:$Position;};`,
  ];

  const { lower } = grammar.inferrer.normalizer;
  const { ruleInterfaces, tokenInterfaces } = grammar.getInterfaces();
  const names = new Map<AnyNormalizedType, string>();
  const astNodes = [];

  for (const [rule, { argTypes, returnType }] of ruleInterfaces) {
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
    lines.push(`type ${name} = ${toTypescript(type, names)};`);
  }

  lines.push(`export type $Nodes = ${astNodes.join("|")};`);

  // TODO token rules
  // TODO grammar class interface with external calls as well

  lines.push(``);
  return lines.join(`\n`);
}
