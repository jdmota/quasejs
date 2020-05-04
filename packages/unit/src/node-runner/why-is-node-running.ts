import { getStack } from "@quase/error";
import asyncHooks from "async_hooks";
import { WhyIsRunning } from "../types";

const FAKE_RESOURCE = new asyncHooks.AsyncResource("QUASEJS");
const ASYNC_ID_SYMBOL = Object.getOwnPropertySymbols(FAKE_RESOURCE).find(
  s => s.toString() === "Symbol(asyncId)"
) as symbol;

const actives: Map<
  number,
  {
    type: string;
    stack: string;
  }
> = new Map();

const hook = asyncHooks.createHook({
  init(asyncId, type) {
    if (type === "TIMERWRAP" || type === "PROMISE") {
      return;
    }
    actives.set(asyncId, {
      type,
      stack: getStack(2),
    });
  },
  destroy(asyncId) {
    actives.delete(asyncId);
  },
});

export function enable() {
  hook.enable();
}

export default function () {
  hook.disable();

  const array: WhyIsRunning = [];

  const p = process as any;

  for (const resource of p._getActiveHandles()) {
    const info = actives.get(resource[ASYNC_ID_SYMBOL]);
    if (info) {
      array.push(info);
    }
  }

  for (const resource of p._getActiveRequests()) {
    const info = actives.get(resource[ASYNC_ID_SYMBOL]);
    if (info) {
      array.push(info);
    }
  }

  actives.clear();
  return array;
}
