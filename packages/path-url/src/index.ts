import path from "path";
import pathToUrl from "file-url";
import slash from "slash";
import isUrl from "is-url-superb";

type Url = string;
type Path = string;

// File paths

export { pathToUrl, slash };

export function isAbsolutePath(file: Path) {
  return path.isAbsolute(file);
}

export function makeAbsolutePath(file: Path) {
  return resolvePath(process.cwd(), file);
}

export function resolvePath(from: Path, to: Path) {
  return path.resolve(from, to);
}

export function resolvePathAsUrl(from: Path, to: Path) {
  return path.resolve(path.dirname(from), to);
}

export function prettifyPath(file: Path): string {
  return slash(path.relative(process.cwd(), file));
}

export function lowerPath(file: Path) {
  return path.sep === "\\" ? file.toLowerCase() : file;
}

// Urls
/* eslint-env browser */

const URL =
  (typeof window !== "undefined" && window.URL) || // eslint-disable-line node/no-unsupported-features/node-builtins
  require("url").URL;
const LOCATION =
  (typeof window !== "undefined" && window.location) ||
  new URL("http://localhost/");

const reAbsUrl = /^[a-z][a-z0-9+.-]*:/;

export function isAbsoluteUrl(url: Url) {
  return reAbsUrl.test(url);
}

export function makeAbsoluteUrl(url: Url): string {
  return new URL(url, LOCATION).href;
}

export function resolveUrl(from: Url, to: Url): string {
  return new URL(to, from).href;
}

export function prettifyUrl(url: Url, opts?: { lastSlash: boolean }): string {
  let { hash, origin, pathname, search } = new URL(url, LOCATION);
  pathname = opts && opts.lastSlash ? pathname : removeLastSlash(pathname);
  origin = origin === LOCATION.origin ? "" : origin;
  return origin + pathname + search + hash;
}

export function removeLastSlash(url: Url) {
  return url.replace(/\/+$/g, "");
}

// Both

export { isUrl };

export function isAbsolute(name: Url | Path) {
  return isUrl(name) ? isAbsoluteUrl(name) : isAbsolutePath(name);
}

export function makeAbsolute(name: Url | Path) {
  return isUrl(name) ? makeAbsoluteUrl(name) : makeAbsolutePath(name);
}

export function resolve(from: Url | Path, to: Url | Path) {
  return isUrl(from) ? resolveUrl(from, to) : resolvePath(from, to);
}

export function resolveAsUrl(from: Url | Path, to: Url | Path) {
  return isUrl(from) ? resolveUrl(from, to) : resolvePathAsUrl(from, to);
}

export function prettify(name: Url | Path, opts?: { lastSlash: boolean }) {
  return isUrl(name) ? prettifyUrl(name, opts) : prettifyPath(name);
}
