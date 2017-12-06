/* @flow */
/* eslint no-use-before-define: 0 */

export type Status = ?( "passed" | "skipped" | "failed" | "todo" );

export type Metadata = {
  type: "test" | "group" | "before" | "after" | "beforeEach" | "afterEach",
  serial: boolean,
  exclusive: boolean,
  strict: boolean,
  status: "" | "skipped" | "todo" | "failing",
  bail: boolean,
  allowNoPlan: boolean
};

export type IRunReturn<+T> = Promise<T> | T;

export interface IRunnableResult {
  level: number,
  failedBecauseOfHook: ?{ level: number },
  skipReason: ?string,
  status: Status
}

export interface GenericRunnable<T> {
  run(): IRunReturn<T>,
  runSkip( ?string ): T,
  runTodo(): T
}

export interface IRunnable extends GenericRunnable<IRunnableResult> {}

export interface ITestResult extends IRunnableResult {
  slow: boolean,
  metadata: Metadata,
  errors: Object[],
  assertions: Object[],
  logs: string[],
  runtime: number
}

export interface ITest extends GenericRunnable<ITestResult> {
  clone( context: Object ): ITest
}

export interface IDeferred<T> {
  promise: Promise<T>,
  resolve: T => void,
  reject: any => void,
}
