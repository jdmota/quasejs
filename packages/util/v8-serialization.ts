import v8 from "v8";

function share(contents: Buffer): SharedArrayBuffer {
  const shared = new SharedArrayBuffer(contents.length);
  const buffer = Buffer.from(shared);
  contents.copy(buffer);
  return shared;
}

const cache = new WeakMap<SharedArrayBuffer, any>();

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm

type V8Serializable =
  | null
  | undefined
  | string
  | number
  | boolean
  | bigint
  | Map<any, any>
  | Set<any>
  // When serializing TypedArray, Buffer or DataView, only the underlying ArrayBuffer is stored
  | ArrayBuffer
  | { readonly [key: string]: V8Serializable }
  | readonly V8Serializable[];

export function serialize(value: V8Serializable) {
  return share(v8.serialize(value));
}

export function deserialize(buffer: SharedArrayBuffer) {
  let value = cache.get(buffer);
  if (!value) {
    value = v8.deserialize(Buffer.from(buffer));
    cache.set(buffer, value);
  }
  return value;
}
