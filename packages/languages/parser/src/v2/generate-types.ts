import { Grammar } from "./grammar";
import {
  ReadonlyFieldsStore,
  ReadonlyFieldStoreValue,
} from "./grammar-checker";

function generateFieldType({
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
}

function generateRuleType(
  grammar: Grammar,
  name: string,
  store: ReadonlyFieldsStore
) {
  const fields = Array.from(store).map(
    field => `  ${field.name}: ${generateFieldType(field)};s`
  );
  return {
    typeName: `${grammar.name}${name}`,
    typeDefinition: [
      `{`,
      `  $type: "${name}";`,
      `  $loc: $Location;`,
      ...fields,
      `}`,
    ].join("\n"),
  };
}

export function generateTypes(grammar: Grammar) {
  const lines = [
    `/* eslint-disable */`,
    `export type $Position = {pos:number;line:number;column:number;};`,
    `export type $Location = {start:$Position;end:$Position;};`,
  ];

  const rulesTypeNames: string[] = [];

  for (const [name, fields] of grammar.fields) {
    const { typeName, typeDefinition } = generateRuleType(
      grammar,
      name,
      fields
    );
    rulesTypeNames.push(typeName);
    lines.push(`export type ${typeName} = ${typeDefinition};`);
  }

  lines.push(`export type $Nodes = ${rulesTypeNames.join("|")}`);

  lines.push(``);
  return lines.join(`\n`);
}
