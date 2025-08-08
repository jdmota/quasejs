import isUnicodeSupportedFun from "is-unicode-supported";

export const isUnicodeSupported = isUnicodeSupportedFun();

// Adapted from https://github.com/nodejs/node/blob/main/lib/internal/util/colors.js#L18
export function streamSupportColors(stream: NodeJS.WritableStream) {
  const s: any = stream;
  return (
    s?.isTTY &&
    (typeof s.getColorDepth === "function" ? s.getColorDepth() > 2 : true)
  );
}

// From https://github.com/parcel-bundler/parcel/blob/v2/packages/reporters/cli/src/emoji.js
// Fallback symbols for Windows from https://en.wikipedia.org/wiki/Code_page_437
export const emoji = {
  progress: isUnicodeSupported ? "⏳" : "∞",
  success: isUnicodeSupported ? "✨" : "√",
  error: isUnicodeSupported ? "🚨" : "×",
  warning: isUnicodeSupported ? "⚠️" : "‼",
  info: isUnicodeSupported ? "ℹ️" : "ℹ",
  hint: isUnicodeSupported ? "💡" : "ℹ",
  docs: isUnicodeSupported ? "📝" : "ℹ",
};
