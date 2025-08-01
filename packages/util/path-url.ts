import path from "node:path";
import url, { fileURLToPath } from "node:url";
import slash from "slash";
import urlRegexDefault from "url-regex";

type Url = string;
type Path = string;

// File paths

export const pathToUrl = url.pathToFileURL;
export const urlToPath = url.fileURLToPath;

export { slash };

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

export function relativePath(id: Path, cwd: Path): Path {
  return path.relative(cwd, id);
}

export function relativePathAsUrl(id: Path, cwd: Path): Path {
  return path.relative(path.dirname(cwd), id);
}

export function prettifyPath(file: Path): string {
  return slash(lowerPath(path.relative(process.cwd(), file)));
}

export function lowerPath(file: Path): Path {
  return path.sep === "\\" ? file.toLowerCase() : file;
}

export function normalizePath(file: Path): Path {
  return slash(lowerPath(makeAbsolutePath(file)));
}

export const reExt = /\.(.+)$/;

export function getType(id: string): string {
  const match = id.match(reExt);
  return match ? match[1] : "";
}

// Adapted from https://github.com/sindresorhus/is-path-inside/blob/main/index.js (4.0.0)
export function isPathInside(
  child: Path,
  parent: Path,
  allowSame: boolean = false
): boolean {
  const relative = path.relative(parent, child);
  return (
    (allowSame || relative.length > 0) &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    relative !== path.resolve(child)
  );
}

// Urls

const LOCATION =
  (typeof window !== "undefined" &&
    window.location &&
    new URL(window.location.href)) ||
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

export function prettifyUrl(
  url: Url,
  opts?: { readonly lastSlash: boolean }
): string {
  const keepLastSlash = opts && opts.lastSlash;
  let { hash, origin, pathname, search, protocol } = new URL(url, LOCATION);
  if (protocol === "file:") {
    if (search || hash) {
      pathname = keepLastSlash ? pathname : removeLastSlash(pathname);
      return "file://" + pathname + search + hash;
    }
    url = keepLastSlash ? url : removeLastSlash(url);
    return prettifyPath(urlToPath(url));
  }
  origin = origin === LOCATION.origin ? "" : origin;
  pathname = keepLastSlash ? pathname : removeLastSlash(pathname);
  return origin + pathname + search + hash;
}

export function removeLastSlash(url: Url) {
  return url.replace(/\/+$/g, "");
}

// Both

const urlRegex = urlRegexDefault({ exact: true });

export function isUrl(url: string) {
  return urlRegex.test(url.trim()) || url.startsWith("file://");
}

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

export function prettify(p: Url | Path, opts?: { lastSlash: boolean }) {
  return isUrl(p) ? prettifyUrl(p, opts) : prettifyPath(p);
}
