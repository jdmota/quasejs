// From https://github.com/parcel-bundler/parcel/blob/v2/packages/reporters/cli/src/emoji.js

const supportsEmoji =
  process.platform !== "win32" || process.env.TERM === "xterm-256color";

// Fallback symbols for Windows from https://en.wikipedia.org/wiki/Code_page_437
export default {
  progress: supportsEmoji ? "⏳" : "∞",
  success: supportsEmoji ? "✨" : "√",
  error: supportsEmoji ? "🚨" : "×",
  warning: supportsEmoji ? "⚠️" : "‼",
  info: supportsEmoji ? "ℹ" : "i",
  hint: supportsEmoji ? "💡" : "ℹ",
};
