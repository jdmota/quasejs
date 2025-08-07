import turbocolor from "turbocolor";

const eol = turbocolor.reset("\n");

export function indentString(str: string, indent?: string | number) {
  indent = indent || 2;
  return (str + "").replace(
    /^(?!\s*$)/gm,
    typeof indent === "number" ? " ".repeat(indent) : indent
  );
}

export function log(str: string, indent?: string | number) {
  process.stdout.write(indentString(str, indent));
}

export function logEol() {
  process.stdout.write(eol);
}
