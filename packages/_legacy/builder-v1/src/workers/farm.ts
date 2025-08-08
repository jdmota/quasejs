import {
  workerMethods,
  IPluginsRunnerInWorker,
} from "../plugins/worker-runner";
import { UserConfig } from "../builder/user-config";

const path = require("path");
const { Worker } = require("worker_threads"); // eslint-disable-line

const maxConcurrentWorkers = Math.max(require("os").cpus().length, 1);
const maxConcurrentCallsPerWorker = 5;

type Defer<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

type MethodName = keyof IPluginsRunnerInWorker;

type CallInfo = {
  method: MethodName;
  args: unknown[];
};

type PendingCall = {
  method: MethodName;
  args: unknown[];
  defer: Defer<unknown>;
  retry: number;
};

type Call = {
  id: number;
  method: MethodName;
  args: unknown[];
  child: Child;
  defer: Defer<unknown>;
  retry: number;
};

type Child = {
  child: any;
  calls: Set<Call>;
  ready: boolean;
  exitTimeout: NodeJS.Timeout | null;
};

type ReceivedData = {
  id: number;
  result: any;
  error: any;
};

export type SentData = {
  id: number;
  method: MethodName;
  args: unknown[];
};

function createDefer(): Defer<unknown> {
  let resolve, reject;
  const promise = new Promise((a, b) => {
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
  private workersInit: Defer<unknown>;
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

  workersReady() {
    return this.workersInit.promise;
  }

  setup(): IPluginsRunnerInWorker {
    const iface: any = {};
    for (const m of workerMethods) {
      iface[m] = this.mkhandle(m);
    }

    while (this.children.size < maxConcurrentWorkers) {
      this.startChild();
    }

    return iface;
  }

  private startChild() {
    const child = new Worker(path.join(__dirname, "fork.js"), {
      workerData: this.initOptions,
    });

    const c: Child = {
      child,
      calls: new Set(),
      ready: false,
      exitTimeout: null,
    };

    child.once("online", () => {
      c.ready = true;
      this.useWorkers = true;
      this.workersInit.resolve(null);
    });

    child.on("message", (msg: ReceivedData) => this.receive(msg));
    child.on("error", () => this.stopChild(c));
    child.once("exit", () => {
      if (c.exitTimeout) {
        clearTimeout(c.exitTimeout);
      }
      this.onExit(c);
    });

    this.children.add(c);
    return c;
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
    const { id, result, error: _error } = data;
    const call = this.calls.get(id);

    if (call) {
      let error;

      if (_error) {
        const { message, stack } = _error;
        error = new Error(message);
        error.stack = stack;
      }

      const { child, defer } = call;

      this.calls.delete(id);
      child.calls.delete(call);

      if (error) {
        defer.reject(error);
      } else {
        defer.resolve(result);
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

    child.child.postMessage(sentData);
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

  private onExit(child: Child) {
    if (this.ended) {
      return;
    }

    this.children.delete(child);
    setTimeout(() => {
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
    }, 10);
  }

  private stopChild(child: Child) {
    if (this.children.delete(child)) {
      child.child.postMessage("die");
      child.exitTimeout = setTimeout(() => {
        child.child.terminate();
      }, 100);
    }
  }

  stop() {
    if (this.ended) {
      return;
    }
    this.ended = true;

    for (const child of this.children) {
      this.stopChild(child);
    }
  }
}
