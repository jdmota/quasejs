import {
  fork,
  ChildProcess,
  type ForkOptions,
  type Serializable,
} from "child_process";
import {
  Worker,
  parentPort,
  MessagePort,
  isMainThread,
} from "node:worker_threads";
import EventEmitter from "events";
import type internal from "node:stream";
import { nonNull } from "./miscellaneous";

type ForkEvents<Receive extends Serializable> = {
  message: [Receive];
  result: [WorkerResult];
};

enum WorkerState {
  RUNNING,
  SHUTTING_DOWN,
  SHUT_DOWN,
}

export type WorkerResult =
  | { errors: Error[]; exit: ExitInfo; hanging: false }
  | { errors: Error[]; exit: null; hanging: true };

export type ExitInfo =
  | { code: number; signal: null }
  | { code: null; signal: NodeJS.Signals };

export interface SimpleFork<
  Send extends Serializable,
  Receive extends Serializable,
> extends EventEmitter<ForkEvents<Receive>> {
  send(message: Send): void;
  terminate(signal?: NodeJS.Signals): boolean;
  justForget(): void;
  stdin: internal.Writable;
  stdout: internal.Readable;
  stderr: internal.Readable;
}

export class ChildProcessFork<
    Send extends Serializable,
    Receive extends Serializable,
  >
  extends EventEmitter<ForkEvents<Receive>>
  implements SimpleFork<Send, Receive>
{
  private readonly process: ChildProcess;
  private state: WorkerState;
  private errors: Error[] = [];
  private deliverImmediately = true;
  private backlog: Send[] = [];
  private deliverNext: (error: Error | null) => void;

  constructor(
    file: string,
    args: readonly string[] = [],
    env: ForkOptions["env"] = {},
    execArgv: readonly string[] = []
  ) {
    super();
    this.state = WorkerState.RUNNING;

    this.process = fork(file, [...args], {
      cwd: process.cwd(),
      env,
      execArgv: [...execArgv],
      serialization: "advanced",
      silent: true,
    });

    this.process.on("message", msg => this.emit("message", msg as Receive));

    this.process.on("error", error => {
      this.errors.push(error);
      this.cleanup();
    });

    this.process.on("exit", () => this.cleanup());

    this.process.on("close", (code, signal) => this.shutdown(code, signal));

    // Based on https://github.com/avajs/ava/blob/main/lib/ipc-flow-control.cjs
    this.deliverNext = (error: Error | null) => {
      if (error != null) {
        this.errors.push(error);
      }
      if (this.canSend()) {
        let ok = true;
        while (ok && this.backlog.length > 0) {
          // Stop sending after backpressure
          ok = this.process.send(this.backlog.shift()!, this.deliverNext);
        }
        // Re-enable immediate delivery if there is no backpressure and the backlog has been cleared
        this.deliverImmediately = ok && this.backlog.length === 0;
      } else {
        this.cleanup();
      }
    };
  }

  get stdin() {
    return nonNull(this.process.stdin);
  }

  get stdout() {
    return nonNull(this.process.stdout);
  }

  get stderr() {
    return nonNull(this.process.stderr);
  }

  private canSend() {
    return (
      this.state === WorkerState.RUNNING &&
      this.errors.length === 0 &&
      this.process.connected
    );
  }

  send(message: Send) {
    if (this.canSend()) {
      if (this.deliverImmediately) {
        // The callback is called in the next tick
        this.deliverImmediately = this.process.send(message, this.deliverNext);
      } else {
        this.backlog.push(message);
      }
    }
  }

  private cleanup() {
    if (this.state === WorkerState.RUNNING) {
      this.state = WorkerState.SHUTTING_DOWN;
      this.backlog.length = 0;
      if (this.process.connected) {
        this.process.disconnect();
      }
    }
  }

  private shutdown(code: number | null, signal: NodeJS.Signals | null) {
    if (this.state === WorkerState.SHUTTING_DOWN) {
      this.state = WorkerState.SHUT_DOWN;
      this.process.removeAllListeners();
      this.emit("result", {
        errors: this.errors,
        exit:
          code == null
            ? { code: null, signal: signal! }
            : { code, signal: null },
        hanging: false,
      });
    }
  }

  justForget() {
    if (this.state === WorkerState.SHUTTING_DOWN) {
      this.state = WorkerState.SHUT_DOWN;
      this.process.unref();
      this.process.removeAllListeners();
      this.emit("result", {
        errors: this.errors,
        exit: null,
        hanging: true,
      });
    }
  }

  terminate(signal?: NodeJS.Signals) {
    if (this.state === WorkerState.SHUT_DOWN) {
      return true;
    }
    this.cleanup();
    return this.process.kill(signal);
  }
}

export class WorkerFork<Send extends Serializable, Receive extends Serializable>
  extends EventEmitter<ForkEvents<Receive>>
  implements SimpleFork<Send, Receive>
{
  private readonly worker: Worker;
  private state: WorkerState;
  private errors: Error[] = [];
  private signal: NodeJS.Signals | null;

  constructor(
    file: string,
    args: readonly string[] = [],
    env: ForkOptions["env"] = {},
    execArgv: readonly string[] = []
  ) {
    super();
    this.state = WorkerState.RUNNING;
    this.signal = null;

    this.worker = new Worker(file, {
      argv: [...args],
      env,
      execArgv: [...execArgv],
      stdin: true,
      stdout: true,
      stderr: true,
    });

    this.worker.on("message", msg => this.emit("message", msg as Receive));

    this.worker.on("messageerror", error => {
      this.errors.push(error);
      this.terminate();
    });

    this.worker.on("error", error => {
      this.errors.push(error);
      this.cleanup();
    });

    this.worker.on("exit", code => {
      this.cleanup();
      this.shutdown(this.signal ? null : code, this.signal);
    });
  }

  get stdin() {
    return nonNull(this.worker.stdin);
  }

  get stdout() {
    return this.worker.stdout;
  }

  get stderr() {
    return this.worker.stderr;
  }

  private canSend() {
    return this.state === WorkerState.RUNNING && this.errors.length === 0;
  }

  send(message: Send) {
    if (this.canSend()) {
      this.worker.postMessage(message);
    }
  }

  private cleanup() {
    if (this.state === WorkerState.RUNNING) {
      this.state = WorkerState.SHUTTING_DOWN;
    }
  }

  private shutdown(code: number | null, signal: NodeJS.Signals | null) {
    if (this.state === WorkerState.SHUTTING_DOWN) {
      this.state = WorkerState.SHUT_DOWN;
      this.worker.removeAllListeners();
      this.emit("result", {
        errors: this.errors,
        exit:
          code == null
            ? { code: null, signal: signal! }
            : { code, signal: null },
        hanging: false,
      });
    }
  }

  justForget() {
    if (this.state === WorkerState.SHUTTING_DOWN) {
      this.state = WorkerState.SHUT_DOWN;
      this.worker.unref();
      this.worker.removeAllListeners();
      this.emit("result", {
        errors: this.errors,
        exit: null,
        hanging: true,
      });
    }
  }

  terminate(signal?: NodeJS.Signals) {
    if (this.state === WorkerState.SHUT_DOWN) {
      return true;
    }
    this.signal = signal ?? null;
    this.cleanup();
    this.worker.terminate();
    return true;
  }
}

type ParentEvents<Receive extends Serializable> = {
  message: [Receive];
  result: [ParentResult];
};

export type ParentResult = { errors: Error[] };

export interface SimpleParent<
  Send extends Serializable,
  Receive extends Serializable,
> extends EventEmitter<ParentEvents<Receive>> {
  send(message: Send): void;
  disconnect(): void;
}

export class ChildProcessParent<
    Send extends Serializable,
    Receive extends Serializable,
  >
  extends EventEmitter<ParentEvents<Receive>>
  implements SimpleParent<Send, Receive>
{
  private readonly _send: (
    message: Send,
    callback: (error: Error | null) => void
  ) => boolean;
  private readonly _onMessage: (msg: unknown) => void;
  private readonly deliverNext: (error: Error | null) => void;
  private disconnected = false;
  private errors: Error[] = [];
  private deliverImmediately = true;
  private backlog: Send[] = [];

  constructor() {
    if (!process.send) {
      throw new Error("No process.send!");
    }
    super();
    this._send = process.send.bind(process);

    this._onMessage = msg => {
      this.emit("message", msg as Receive);
    };
    process.on("message", this._onMessage);

    // Based on https://github.com/avajs/ava/blob/main/lib/ipc-flow-control.cjs
    this.deliverNext = (error: Error | null) => {
      if (error != null) {
        this.errors.push(error);
      }
      if (this.canSend()) {
        let ok = true;
        while (ok && this.backlog.length > 0) {
          // Stop sending after backpressure
          ok = this._send(this.backlog.shift()!, this.deliverNext);
        }
        // Re-enable immediate delivery if there is no backpressure and the backlog has been cleared
        this.deliverImmediately = ok && this.backlog.length === 0;
      } else {
        this.disconnect();
      }
    };
  }

  private canSend() {
    return !this.disconnected && this.errors.length === 0 && process.connected;
  }

  send(message: Send) {
    if (this.canSend()) {
      if (this.deliverImmediately) {
        // The callback is called in the next tick
        this.deliverImmediately = this._send(message, this.deliverNext);
      } else {
        this.backlog.push(message);
      }
    }
  }

  disconnect() {
    if (!this.disconnected) {
      this.disconnected = true;
      this.backlog.length = 0;
      process.off("message", this._onMessage);
      this.emit("result", { errors: this.errors });
    }
  }
}

export class WorkerParent<
    Send extends Serializable,
    Receive extends Serializable,
  >
  extends EventEmitter<ParentEvents<Receive>>
  implements SimpleParent<Send, Receive>
{
  private readonly parentPort: MessagePort;
  private readonly _onMessage: (msg: unknown) => void;
  private readonly _onError: (error: Error) => void;
  private errors: Error[] = [];
  private disconnected = false;

  constructor() {
    if (isMainThread) {
      throw new Error("In main thread");
    }
    if (!parentPort) {
      throw new Error("No parent port!");
    }
    super();
    this.parentPort = parentPort;

    this._onMessage = msg => {
      this.emit("message", msg as Receive);
    };
    parentPort.on("message", this._onMessage);

    this._onError = error => {
      this.errors.push(error);
    };
    parentPort.on("messageerror", this._onError);
  }

  private canSend() {
    return !this.disconnected && this.errors.length === 0;
  }

  send(message: Send) {
    if (this.canSend()) {
      this.parentPort.postMessage(message);
    }
  }

  disconnect() {
    if (!this.disconnected) {
      this.disconnected = true;
      this.parentPort.off("message", this._onMessage);
      this.parentPort.off("message", this._onError);
      this.emit("result", { errors: this.errors });
    }
  }
}
