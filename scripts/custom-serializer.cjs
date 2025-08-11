//@ts-check
const path = require("node:path");

/**
 * Adapted from packages/util/path-url.ts
 * @param {string} file
 */
function prettifyPath(file) {
  return lowerPath(path.relative(process.cwd(), file)).replaceAll("\\", "/");
}

/**
 * From packages/util/path-url.ts
 * @param {string} file
 */
function lowerPath(file) {
  return path.sep === "\\" ? file.toLowerCase() : file;
}

/**
 * TODO use RegExp.escape in the future
 * From https://github.com/sindresorhus/escape-string-regexp/blob/main/index.js
 * @param {string} string
 */
function escapeStringRegexp(string) {
  return string.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&").replace(/-/g, "\\x2d");
}

const cwd = escapeStringRegexp(process.cwd());
const sep = escapeStringRegexp(path.sep);
const rePath = new RegExp(`${cwd}(${sep}[a-z0-9_\\-.]+)*`, "ig");

/** @type {import('pretty-format').NewPlugin} */
const customSerializer = {
  serialize(val, config, indentation, depth, refs, printer) {
    const result = printer(
      val,
      {
        ...config,
        // To avoid stack overflow
        plugins: config.plugins.filter(p => p !== customSerializer),
      },
      indentation,
      depth,
      refs
    );
    return result.replaceAll(rePath, match => prettifyPath(match));
  },

  test(val) {
    return true;
  },
};

module.exports = customSerializer;
