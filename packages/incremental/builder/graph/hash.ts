import crypto from "crypto";

export function hashName(
  input: crypto.BinaryLike,
  used: Set<string>,
  initialLen: number
): string {
  // Produces a string with length 32
  const hash = crypto.createHash("md5").update(input).digest("hex");
  let len = initialLen;
  let conflict = 0;
  let sub;
  do {
    if (len <= 32) {
      sub = hash.substring(0, len);
      len++;
    } else {
      sub = hash + conflict.toString(16);
      conflict++;
    }
  } while (used.has(sub));
  used.add(sub);
  return sub;
}
