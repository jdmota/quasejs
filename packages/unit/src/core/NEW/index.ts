import { RunningContext } from "./runnable";
import { RunnableCtx, RunnableDesc, RunnableOpts } from "./runnable-desc";
import { Runner, GlobalRunnerOptions } from "./runner";

const runnerTests: { ref: RunnableDesc[] | null } = { ref: [] };

export let runner: Runner;

export let t: RunnableCtx;

export function test(
  fn: (ctx: RunningContext) => Promise<void> | void
): RunnableDesc;
export function test(
  title: string,
  fn: (ctx: RunningContext) => Promise<void> | void
): RunnableDesc;
export function test(title: any, fn?: any) {
  return t.test(title, fn);
}

export function _setup(
  runnerOpts: RunnableOpts,
  runnerGlobalOpts: GlobalRunnerOptions,
  tOpts: RunnableOpts
) {
  if (runner) {
    throw new Error("Already setup");
  }
  runner = new Runner(
    new RunnableCtx(runnerOpts, runnerTests),
    runnerGlobalOpts,
    runnerTests
  );
  t = new RunnableCtx(tOpts, runnerTests);
}
