import { AsyncLocalStorage } from "node:async_hooks";
import { RunnableTest } from "../runnable";

const asyncLocalStorage = new AsyncLocalStorage<RunnableTest>();

export function getContext() {
  return asyncLocalStorage.getStore();
}

export function runWithCtx<T>(test: RunnableTest, fn: () => T) {
  return asyncLocalStorage.run(test, fn);
}
