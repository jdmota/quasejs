import path from "path";
import { AliasType, generate } from "./generator";
import * as _types from "./more-types";

function isObject(obj: unknown): obj is object {
  return typeof obj === "object" && obj != null;
}

const filename = path.resolve(__dirname, "../../src/types/generated.ts");
const types = Object.values(_types).filter(
  (v): v is AliasType => isObject(v) && v.t === "alias"
);

generate(filename, types).then(
  _code =>
    console.log(
      filename,
      types.map(t => t.name)
    ),
  e => console.error(e)
);
