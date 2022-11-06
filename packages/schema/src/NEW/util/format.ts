export type Formatter = (value: unknown) => string;

export function format(value: unknown) {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (value === "") return "an empty string";
  if (Number.isNaN(value)) return "NaN";
  return JSON.stringify(value);
}

export function formatKey(key: string) {
  return JSON.stringify(key);
}
