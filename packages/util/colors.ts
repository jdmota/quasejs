// Adapted from https://github.com/nodejs/node/blob/main/lib/internal/util/colors.js#L18
export function streamSupportColors(stream: NodeJS.WritableStream) {
  const s: any = stream;
  return (
    s?.isTTY &&
    (typeof s.getColorDepth === "function" ? s.getColorDepth() > 2 : true)
  );
}
