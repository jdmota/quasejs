import { createDefer, type Defer } from "./deferred";
import { never } from "./miscellaneous";
import { Result } from "./monads";

export type TaskOpts = {
  readonly signal: AbortSignal;
  readonly isActive: () => boolean;
};

export type TaskUserFn<Arg, Ret> = (
  arg: Arg,
  opts: TaskOpts
) => Ret | Promise<Ret>;

export type TaskFn<Arg, Ret> = (
  arg: Arg,
  opts: TaskOpts
) => Promise<Result<Awaited<Ret>, unknown>>;

export interface Task<Arg, Ret> {
  exec(arg: Arg): Promise<TaskResult<Ret>>;
  interrupt(): void;
  kill(): void;
  getState(): TaskState;
  getResult(): TaskResult<Ret> | null;
}

export enum TaskState {
  IDLE,
  RUNNING,
  INTERRUPTING,
  FINISHED,
}

export type TaskResult<Ret> =
  | {
      type: "finished";
      result: Ret;
    }
  | {
      type: "errored";
      error: unknown;
    }
  | {
      type: "cancelled";
    }
  | { type: "killed" };

// Lifecycle:
// IDLE : { result == null, job == null }
// RUNNING : { result == null, job != null }
// INTERRUPTING : { result == null, job != null }
// FINISHED : { result != null }

export class FuncTask<Arg, Ret> implements Task<Arg, Ret> {
  private readonly controller: AbortController;
  private readonly defer: Defer<Ret>;
  private state: TaskState;
  private result: TaskResult<Ret> | null;
  private job: Promise<TaskResult<Ret>> | null;

  constructor(private readonly fn: TaskUserFn<Arg, Ret>) {
    this.controller = new AbortController();
    this.defer = createDefer();
    this.state = TaskState.IDLE;
    this.result = null;
    this.job = null;
  }

  exec(arg: Arg): Promise<TaskResult<Ret>> {
    if (this.result) return Promise.resolve(this.result);
    return this.job ?? (this.job = this.execJob(arg));
  }

  private async execJob(arg: Arg): Promise<TaskResult<Ret>> {
    this.state = TaskState.RUNNING;
    const { fn } = this;
    try {
      const result = await Promise.race([
        fn(arg, {
          signal: this.controller.signal,
          isActive: () => this.state === TaskState.RUNNING,
        }),
        this.defer.promise,
      ]);
      return this.finish({
        type: "finished",
        result,
      });
    } catch (error: unknown) {
      return this.finish({
        type: "errored",
        error,
      });
    }
  }

  private finish(result: TaskResult<Ret>) {
    if (this.result) return this.result;
    this.result = result;
    this.state = TaskState.FINISHED;
    return result;
  }

  interrupt() {
    switch (this.state) {
      case TaskState.IDLE:
        this.finish({
          type: "cancelled",
        });
        break;
      case TaskState.RUNNING:
        this.state = TaskState.INTERRUPTING;
        this.controller.abort();
        break;
      case TaskState.INTERRUPTING:
      case TaskState.FINISHED:
        break;
      default:
        never(this.state);
    }
  }

  kill() {
    switch (this.state) {
      case TaskState.IDLE:
        this.finish({
          type: "cancelled",
        });
        break;
      case TaskState.RUNNING:
      case TaskState.INTERRUPTING:
        this.finish({
          type: "killed",
        });
        this.controller.abort();
        this.defer.reject(new Error("killed"));
        break;
      case TaskState.FINISHED:
        break;
      default:
        never(this.state);
    }
  }

  getState() {
    return this.state;
  }

  getResult() {
    return this.result;
  }
}

export function createTask<Arg, Ret>(
  fn: TaskUserFn<Arg, Ret>
): TaskFn<Arg, Ret> {
  return async (arg: Arg, opts: TaskOpts) => {
    const { signal } = opts;
    if (signal.aborted) {
      return Result.error(signal.reason);
    }
    try {
      const result = await fn(arg, opts);
      return Result.ok(result);
    } catch (error: unknown) {
      return Result.error(error);
    }
  };
}
