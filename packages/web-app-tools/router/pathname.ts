import { type Opaque } from "../utils";

export type NormalizedPathname = Opaque<string, "NormalizedPathname">;
export type NormalizedSearch = Opaque<string, "NormalizedSearch">;
export type NormalizedHash = Opaque<string, "NormalizedHash">;

const reSlashes = /(^\/+)|(\/+$)/g;
const reQuestion = /^\?+/;
const reHash = /^#+/;

export const normalizers = {
  // Should have one leading / but no trailing /
  pathname(str: string): NormalizedPathname {
    return `/${str.trim().replace(reSlashes, "")}` as NormalizedPathname;
  },
  // No leading ?
  search(str: string): NormalizedSearch {
    return str.trim().replace(reQuestion, "") as NormalizedSearch;
  },
  // No leading #
  hash(str: string): NormalizedHash {
    return str.trim().replace(reHash, "") as NormalizedHash;
  },
};

export function startsWith(
  pathname: NormalizedPathname,
  base: NormalizedPathname
) {
  return base === pathname || pathname.startsWith(base + "/");
}

// Simple location

export type RawSimpleLocation = Readonly<{
  pathname: string;
  search?: string;
  hash?: string;
}>;

export type SimpleLocation = Readonly<{
  pathname: NormalizedPathname;
  search: NormalizedSearch;
  hash: NormalizedHash;
}>;

export function createSimpleLocation({
  pathname,
  search,
  hash,
}: RawSimpleLocation): SimpleLocation {
  return {
    pathname: normalizers.pathname(pathname),
    search: normalizers.search(search ?? ""),
    hash: normalizers.hash(hash ?? ""),
  };
}

export function simpleLocationToHref({
  pathname,
  search,
  hash,
}: SimpleLocation) {
  return `${pathname}${search ? "?" + search : ""}${hash ? "#" + hash : ""}`;
}

export function sameSimpleLocation(
  { pathname, search, hash }: SimpleLocation,
  { pathname: pathname2, search: search2, hash: hash2 }: SimpleLocation
) {
  return pathname === pathname2 && search === search2 && hash === hash2;
}

export function sameSimpleLocationExceptHash(
  { pathname, search, hash }: SimpleLocation,
  { pathname: pathname2, search: search2, hash: hash2 }: SimpleLocation
) {
  return pathname === pathname2 && search === search2 && hash !== hash2;
}

// Simple location without hash

export type RawSimpleLocationNoHash = Readonly<{
  pathname: string;
  search?: string;
}>;

export type SimpleLocationNoHash = Readonly<{
  pathname: NormalizedPathname;
  search: NormalizedSearch;
}>;

export function createSimpleLocationNoHash({
  pathname,
  search,
}: RawSimpleLocationNoHash): SimpleLocationNoHash {
  return {
    pathname: normalizers.pathname(pathname),
    search: normalizers.search(search ?? ""),
  };
}

export function simpleLocationNoHashToHref({
  pathname,
  search,
}: SimpleLocationNoHash) {
  return `${pathname}${search ? "?" + search : ""}`;
}

export function sameSimpleLocationNoHash(
  { pathname, search }: SimpleLocationNoHash,
  { pathname: pathname2, search: search2 }: SimpleLocationNoHash
) {
  return pathname === pathname2 && search === search2;
}
