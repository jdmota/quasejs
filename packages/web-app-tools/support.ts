const getGlobal = function () {
  if (typeof self !== "undefined") {
    return self;
  }
  if (typeof window !== "undefined") {
    return window;
  }
  return null;
};

export const SSR = typeof document === "undefined";

export const globalThis = getGlobal();

export const localStorage = globalThis?.localStorage;

export const matchMedia = globalThis?.matchMedia
  ? (query: string) => globalThis.matchMedia(query)
  : null;

export const BroadcastChannel = globalThis?.BroadcastChannel;

export type BroadcastChannelType = NonNullable<typeof BroadcastChannel>;

export const cacheStorage = globalThis?.caches;

export const storageEstimate = globalThis?.navigator?.storage?.estimate
  ? () => globalThis.navigator.storage.estimate()
  : undefined;

export const indexedDB = globalThis?.indexedDB;

type SimpleShareData = Readonly<{
  title?: string;
  text?: string;
  url: string;
}>;

export const share =
  globalThis?.navigator?.canShare &&
  globalThis?.navigator?.canShare({ url: "http://example.com" })
    ? (data: SimpleShareData) => globalThis.navigator.share(data)
    : null;

export function shouldSaveData() {
  //@ts-ignore
  if (navigator.connection) {
    //@ts-ignore
    return navigator.connection.saveData;
  }
  return true;
}
