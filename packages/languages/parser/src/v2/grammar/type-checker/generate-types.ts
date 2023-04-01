import { Grammar } from "../grammar";
import { TypesInferrer } from "./inferrer";
import { AnyNormalizedType } from "./normalizer";
import { never, nonNull } from "../../utils";

function toTypescript(type: AnyNormalizedType, names: Names): string {
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
        .map((a, i) => `arg${i}: ${toTypescript(a, names)}`)
        .join(", ")}) => ${toTypescript(type.ret, names)})`;
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
      return names.get(type.get());
    case "GenericType":
      const lower = toTypescript(type.lower, names);
      const upper = toTypescript(type.upper, names);
      return `T${type.id} /* [${lower}; ${upper}] */`;
    default:
      never(type);
  }
}

class Names {
  private names = new Map<AnyNormalizedType, string>();
  private uuid = 1;

  get(type: AnyNormalizedType) {
    let name = this.names.get(type);
    if (name == null) {
      name = `$rec${this.uuid++}`;
      this.names.set(type, name);
    }
    return name;
  }

  set(type: AnyNormalizedType, proposal: string) {
    let name = this.names.get(type);
    if (name == null) {
      name = proposal;
      this.names.set(type, proposal);
    }
    return name;
  }

  [Symbol.iterator]() {
    return this.names.entries();
  }
}

// TODO need minimization on intersections
// TODO better choose generic types, we cannot just choose the lower bound...

export function generateTypes(grammar: Grammar, inferrer: TypesInferrer) {
  inferrer.registry.propagatePolarities();

  const lines = [
    `/* eslint-disable */`,
    `export type $Position = {pos:number;line:number;column:number;};`,
    `export type $Location = {start:$Position;end:$Position;};`,
  ];

  const normalizer = inferrer.normalizer;
  const names = new Names();
  const astNodes = [];

  for (const [rule, { argTypes, returnType }] of inferrer.getRuleInterfaces()) {
    const normalizedArgs = Array.from(argTypes).map(
      ([name, type]) => [name, normalizer.normalize(type)] as const
    );
    const normalizedReturn = normalizer.normalize(returnType);

    normalizedArgs.forEach(([name, type]) =>
      names.set(type, `${rule.name}_${name}`)
    );
    names.set(normalizedReturn, rule.name);
    astNodes.push(rule.name);
  }

  lines.push(`export type $Nodes = ${astNodes.join("|")};`);

  lines.push(`export type $ExternalCalls = {`);
  for (const [callName, funcType] of inferrer.getExternalCallInterfaces()) {
    lines.push(
      `  ${callName}: ${toTypescript(normalizer.normalize(funcType), names)};`
    );
  }
  lines.push(`};`);

  // TODO token rules

  for (const [type, name] of names) {
    lines.push(`export type ${name} = ${toTypescript(type, names)};`);
  }

  lines.push(``);
  return lines.join(`\n`);
}
