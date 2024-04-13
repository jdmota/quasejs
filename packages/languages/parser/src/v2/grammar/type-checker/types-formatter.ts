import { never } from "../../utils/index";
import { GRecursiveType, GType } from "./types-builder";

export function typeFormatter(
  t: GType,
  knownNames: ReadonlyMap<GType, string> = new Map()
) {
  const eq: [string, string][] = [];
  return {
    typescript: typeFormatterAux(t, eq, new Map(), knownNames),
    eq,
  };
}

const VALID_ID = /^[$_a-z][$_a-z0-9]*$/i;

function typeFormatterAux(
  t: GType,
  eq: [string, string][],
  recNames: Map<GRecursiveType, string>,
  knownNames: ReadonlyMap<GType, string>
): string {
  const known = knownNames.get(t);
  if (known) return known;

  const f = (t: GType) => typeFormatterAux(t, eq, recNames, knownNames);
  switch (t.type) {
    case "func":
      return `((${t.args.map((t, i) => `_${i}: ${f(t)}`).join(", ")}) => ${f(
        t.ret
      )})`;
    case "readObject":
      if (t.fields.size === 0) {
        return "Readonly<Record<string, never>>";
      }
      return `Readonly<{ ${Array.from(t.fields)
        .map(([k, v]) => `${VALID_ID.test(k) ? k : JSON.stringify(k)}: ${f(v)}`)
        .join(", ")} }>`;
    case "readArray":
      return `readonly ${f(t.component)}[]`;
    case "array":
      return `${f(t.component)}[]`;
    case "null":
      return "null";
    case "string":
      return "string";
    case "int":
      return "number";
    case "bool":
      return "boolean";
    case "top":
      return "unknown";
    case "bot":
      return "never";
    case "recursive": {
      const id = `$_T${recNames.size}`;
      recNames.set(t, id);
      eq.push([id, f(t.content)]);
      return id;
    }
    case "recursive-var": {
      const def = t.definition();
      const name = recNames.get(def);
      if (name) return name;
      return f(def);
    }
    case "union":
      return `(${Array.from(t.types).map(f).join(" | ")})`;
    case "inter":
      return `(${Array.from(t.types).map(f).join(" & ")})`;
    default:
      never(t);
  }
}
