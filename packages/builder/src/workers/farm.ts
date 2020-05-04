import os from "os";
import path from "path";
import { Worker } from "worker_threads";
import {
  workerMethods,
  IPluginsRunnerInWorker,
} from "../plugins/worker-runner";
import { UserConfig } from "../builder/user-config";
import {
  Diagnostic,
  SerializedDiagnostic,
  deserializeDiagnostic,
} from "../utils/error";

const maxConcurrentWorkers = Math.max(os.cpus().length, 1);
const maxConcurrentCallsPerWorker = 5;

type PossibleErrors = string | Error | Diagnostic;

type Defer<T, E> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: E) => void;
};

type MethodName = keyof IPluginsRunnerInWorker;

type CallInfo = {
  method: MethodName;
  args: unknown[];
};

type PendingCall = {
  method: MethodName;
  args: unknown[];
  defer: Defer<unknown, PossibleErrors>;
  retry: number;
};

type Call = {
  id: number;
  method: MethodName;
  args: unknown[];
  child: Child;
  defer: Defer<unknown, PossibleErrors>;
  retry: number;
};

type Child = {
  worker: Worker;
  calls: Set<Call>;
  ready: boolean;
  exitTimeout: NodeJS.Timeout | null;
  exitDefer: Defer<null, PossibleErrors>;
};

export type ReceivedData =
  | {
      id: number;
      result: any;
      error: null;
    }
  | {
      id: number;
      result: null;
      error: SerializedDiagnostic;
    };

export type SentData = {
  id: number;
  method: MethodName;
  args: unknown[];
};

function createDefer<T, E>(): Defer<T, E> {
  let resolve, reject;
  const promise = new Promise<T>((a, b) => {
    resolve = a;
    reject = b;
  });
  return {
    promise,
    // @ts-ignore
    resolve,
    // @ts-ignore
    reject,
  };
}

export class Farm {
  private children: Set<Child>;
  private calls: Map<number, Call>;
  private initOptions: UserConfig;
  private workersInit: Defer<unknown, unknown>;
  private useWorkers: boolean;
  private callUUID: number;
  private pending: PendingCall[];
  private ended: boolean;

  constructor(initOptions: UserConfig) {
    this.children = new Set();
    this.calls = new Map();
    this.initOptions = initOptions;
    this.workersInit = createDefer();
    this.useWorkers = false;
    this.callUUID = 1;
    this.pending = [];
    this.ended = false;
  }

  private mkhandle(method: MethodName) {
    return (...args: unknown[]) => {
      return this.addCall({
        method,
        args,
      });
    };
  }

  interface(): IPluginsRunnerInWorker {
    return {
      transform: this.mkhandle("transform"),
      renderAsset: this.mkhandle("renderAsset"),
    };
  }

  async setup() {
    while (this.children.size < maxConcurrentWorkers) {
      this.startChild();
    }

    await this.workersInit.promise;
  }

  private startChild() {
    const worker = new Worker(path.join(__dirname, "fork.js"), {
      workerData: this.initOptions,
    });

    const child: Child = {
      worker,
      calls: new Set(),
      ready: false,
      exitTimeout: null,
      exitDefer: createDefer(),
    };

    worker.once("online", () => {
      child.ready = true;
      this.useWorkers = true;
      this.workersInit.resolve(null);
    });

    worker.on("message", (msg: ReceivedData) => this.receive(msg));
    worker.on("error", () => this.stopChild(child));
    worker.once("exit", () => this.onChildExit(child));

    this.children.add(child);
    return child;
  }

  private findChild(): Child | null {
    let child = null;
    let max = maxConcurrentCallsPerWorker;

    // Choose worker with less pending calls
    for (const worker of this.children) {
      if (worker.ready && worker.calls.size < max) {
        child = worker;
        max = worker.calls.size;
      }
    }

    return child;
  }

  private async addCall(callInfo: CallInfo): Promise<any> {
    const defer = createDefer();
    if (this.ended) {
      return defer.promise;
    }

    if (!this.useWorkers) {
      await this.workersInit.promise;
    }

    const { method, args } = callInfo;

    this.pending.push({
      method,
      args,
      defer,
      retry: 0,
    });

    this.processPending();
    return defer.promise;
  }

  private receive(data: ReceivedData) {
    const { id } = data;
    const call = this.calls.get(id);

    if (call) {
      const { child, defer } = call;

      this.calls.delete(id);
      child.calls.delete(call);

      if (data.error) {
        defer.reject(deserializeDiagnostic(data.error));
      } else {
        defer.resolve(data.result);
      }
    }

    this.processPending();
  }

  private send(child: Child, pendingCall: PendingCall) {
    const id = this.callUUID++;
    const { method, args, defer, retry } = pendingCall;
    const call: Call = {
      id,
      method,
      args,
      child,
      defer,
      retry,
    };

    this.calls.set(id, call);
    child.calls.add(call);

    const sentData: SentData = {
      id,
      method,
      args,
    };

    child.worker.postMessage(sentData);
  }

  private processPending() {
    if (this.ended || this.pending.length === 0) {
      return;
    }

    if (this.children.size < maxConcurrentWorkers) {
      this.startChild();
    }

    let child, pending;
    while ((child = this.findChild()) && (pending = this.pending.shift())) {
      this.send(child, pending);
    }
  }

  private onChildExit(child: Child) {
    if (child.exitTimeout) {
      clearTimeout(child.exitTimeout);
    }
    child.exitDefer.resolve(null);

    if (this.ended) {
      return;
    }

    this.children.delete(child);

    for (const call of child.calls) {
      this.calls.delete(call.id);

      if (call.retry > 2) {
        call.defer.reject(new Error("Exceeded retries"));
      } else {
        this.pending.push({
          method: call.method,
          args: call.args,
          defer: call.defer,
          retry: call.retry + 1,
        });
      }
    }
    this.processPending();
  }

  private stopChild(child: Child) {
    if (this.children.delete(child)) {
      child.worker.postMessage("stop");
      child.exitTimeout = setTimeout(() => child.worker.terminate(), 100);
    }
  }

  async stop() {
    if (this.ended) {
      return;
    }
    this.ended = true;

    const children = Array.from(this.children);

    this.pending.length = 0;
    this.calls.clear();
    this.children.clear();

    for (const child of children) {
      this.stopChild(child);
    }

    for (const child of children) {
      await child.exitDefer.promise;
    }
  }
}
