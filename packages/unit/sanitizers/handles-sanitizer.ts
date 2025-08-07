import { createHook } from "node:async_hooks";
import { getStack } from "../../error/src/index";
import { RunnableTest } from "../runnable";
import { getContext } from "./context-tracker";

// Based on https://github.com/jestjs/jest/blob/main/packages/jest-core/src/collectHandles.ts

const IGNORED_TYPES = [
  "PROMISE",
  "TIMERWRAP",
  "ELDHISTOGRAM",
  "PerformanceObserver",
  "RANDOMBYTESREQUEST",
  "DNSCHANNEL",
  "ZLIB",
  "SIGNREQUEST",
  "TLSWRAP",
  "TCPWRAP",
];

export type ActiveHandle = Readonly<{
  type: string;
  stack: string;
}>;

const activeHandles = new Map<
  number,
  {
    starter: RunnableTest;
    type: string;
    stack: string;
    handle: WeakRef<{ hasRef?: () => boolean }>;
  }
>();

const hook = createHook({
  init: (asyncId, type, triggerAsyncId, resource) => {
    if (IGNORED_TYPES.includes(type)) {
      return;
    }
    const starter = getContext();
    if (starter) {
      activeHandles.set(asyncId, {
        starter,
        type,
        stack: getStack(2),
        handle: new WeakRef(resource),
      });
    }
  },
  destroy: asyncId => {
    activeHandles.delete(asyncId);
  },
});

export function enableHandlesTracker() {
  hook.enable();
}

export function disableHandlesTracker() {
  hook.disable();
}

export async function getActiveHandles(
  test: RunnableTest
): Promise<readonly ActiveHandle[]> {
  await new Promise(r => setTimeout(r, 0));
  const arr = [];
  const asyncIds = [];
  for (const [asyncId, { starter, type, stack, handle }] of activeHandles) {
    if (starter === test) {
      const r = handle.deref();
      if (r && (r.hasRef?.() ?? true)) {
        arr.push({ type, stack });
      }
      asyncIds.push(asyncId);
    }
  }
  for (const id of asyncIds) activeHandles.delete(id);
  return arr;
}

/*const FAKE_RESOURCE = new AsyncResource("QUASEJS");
const ASYNC_ID_SYMBOL = Object.getOwnPropertySymbols(FAKE_RESOURCE).find(
  s => s.toString().startsWith("Symbol(async") // Symbol(asyncId) or Symbol(async_id_symbol)
) as symbol;

console.log(FAKE_RESOURCE);
console.log(Object.getOwnPropertySymbols(FAKE_RESOURCE));
console.log(ASYNC_ID_SYMBOL);
console.log(whyIsNodeRunning());

export function whyIsNodeRunning() {
  const array: ActiveHandle = [];
  const p = process as any;

  for (const resource of p._getActiveHandles()) {
    array.push(resource, resource[ASYNC_ID_SYMBOL]);
  }

  for (const resource of p._getActiveRequests()) {
    array.push(resource, resource[ASYNC_ID_SYMBOL]);
  }

  return array;
}*/
