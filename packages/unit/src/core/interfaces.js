/* @flow */
/* eslint no-use-before-define: 0 */

export type Status = ?( "passed" | "skipped" | "failed" | "todo" );

export type Metadata = Object;

export type IRunReturn<+T> = T | Promise<T>;

export type GenericRunnable<T> = $Subtype<{
  run(): IRunReturn<T>,
  runSkip( ?string ): T
}>;

export interface MinimalRunnable extends GenericRunnable<IRunnable> {}

export interface MinimalTest extends MinimalRunnable, GenericRunnable<ITest> {
  clone( context: Object ): MinimalTest
}

export interface IRunnable extends MinimalRunnable {
  level: number,
  failedBecauseOfHook: ?{ level: number },
  skipReason: ?string,
  status: Status
}

export interface ITest extends IRunnable, MinimalTest {
  slow: boolean,
  metadata: Metadata,
  errors: Object[],
  assertions: Object[],
  runtime: number
}

export interface IDeferred<T> {
  promise: Promise<T>,
  resolve: T => void,
  reject: any => void,
}
