// @flow
import { type ContextRef } from "./context";

/* eslint no-use-before-define: 0 */

export type Status = ?( "passed" | "skipped" | "failed" | "todo" );

export type GroupMetadata = {
  +type: "group",
  +serial: boolean,
  +exclusive: boolean,
  +strict: boolean,
  +status: "" | "skipped" | "todo" | "failing",
  +bail: boolean,
  +allowNoPlan: boolean
};

export type TestMetadata = {
  +type: "test" | "before" | "after" | "beforeEach" | "afterEach",
  +serial: boolean,
  +exclusive: boolean,
  +strict: boolean,
  +status: "" | "skipped" | "todo" | "failing",
  +bail: boolean,
  +allowNoPlan: boolean
};

export type IRunReturn<+T> = Promise<T> | T;

export interface IRunnableResult {
  +level: number,
  failedBecauseOfHook: ?{ level: number },
  skipReason: ?string,
  status: Status
}

export interface GenericRunnable<T> {
  run( ContextRef ): IRunReturn<T>,
  runSkip( ?string ): T,
  runTodo(): T
}

export interface IRunnable extends GenericRunnable<IRunnableResult> {}

export interface ITestResult extends IRunnableResult {
  +metadata: TestMetadata,
  slow: boolean,
  errors: Object[],
  assertions: Object[],
  logs: string[],
  runtime: number
}

export interface ITest extends GenericRunnable<ITestResult> {
  clone(): ITest
}

export interface IDeferred<T> {
  promise: Promise<T>,
  resolve: T => void,
  reject: any => void,
}
