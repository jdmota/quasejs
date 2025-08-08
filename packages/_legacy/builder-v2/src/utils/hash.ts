import crypto from "crypto";
import { ImmutableData, Data } from "../types";

function h(input: ImmutableData) {
  return crypto
    .createHash("md5")
    .update(input as Data)
    .digest("hex");
}

export default function(input: ImmutableData) {
  return h(input).slice(0, 10);
}

export function hashName(
  input: ImmutableData,
  usedIds: Set<string>,
  len: number
): string {
  const id = h(input);
  while (usedIds.has(id.substr(0, len))) {
    len++;
  }
  return id.substr(0, len);
}
