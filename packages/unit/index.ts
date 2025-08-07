import { type RunningContext } from "./runnable";
import {
  RunnableBuilder,
  RunnableDesc,
  type RunnableOpts,
} from "./runnable-desc";
import { Runner } from "./runner";

const runnerTests: { ref: RunnableDesc[] | null } = { ref: null };

export let runner: Runner;

export let t: RunnableBuilder;

export function test(
  fn: (ctx: RunningContext) => Promise<void> | void
): RunnableDesc;
export function test(
  title: string,
  fn: (ctx: RunningContext) => Promise<void> | void
): RunnableDesc;
export function test(title: any, fn?: any) {
  return t.test(title, fn, true);
}

export function _setup(runnerOpts: RunnableOpts, tOpts: RunnableOpts) {
  if (runner) {
    throw new Error("Already setup");
  }
  runner = new Runner(
    new RunnableBuilder(runnerOpts, runnerTests),
    runnerTests
  );
  t = new RunnableBuilder(tOpts, runnerTests);
}
