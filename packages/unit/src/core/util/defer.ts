import { Deferred } from "../../types";

export default function <T>(): Deferred<T> {
  let resolve, reject;
  return {
    promise: new Promise((a, b) => {
      resolve = a;
      reject = b;
    }),
    // @ts-ignore
    resolve: resolve,
    // @ts-ignore
    reject: reject,
  };
}
