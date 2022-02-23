import { isMainThread, parentPort, workerData } from "worker_threads";
import { PluginsRunnerInWorker } from "../plugins/worker-runner";
import { UserConfig } from "../builder/user-config";
import { SentData, ReceivedData } from "./farm";
import { serializeDiagnostic, createDiagnosticFromAny } from "../utils/error";

if (isMainThread || !parentPort) {
  throw new Error("This file should only be loaded by workers");
}

const runnerInit = (async () => {
  const runner = new PluginsRunnerInWorker(new UserConfig(workerData));
  await runner.init();
  return runner;
})();

async function runMethod(
  runner: PluginsRunnerInWorker,
  method: SentData["method"],
  args: any[]
) {
  if (method === "transform") {
    return runner.transform(args[0]);
  }
  if (method === "renderAsset") {
    return runner.renderAsset(args[0], args[1], args[2]);
  }
  throw new Error(`Worker: No method ${method}`);
}

(parentPort => {
  async function handle({ id, method, args }: SentData) {
    let data: ReceivedData;
    try {
      const runner = await runnerInit;
      const result = await runMethod(runner, method, args);
      data = {
        id,
        result,
        error: null,
      };
    } catch (error) {
      data = {
        id,
        result: null,
        error: serializeDiagnostic(createDiagnosticFromAny(error)),
      };
    }
    parentPort.postMessage(data);
  }

  parentPort.on("message", (data: "stop" | SentData) => {
    if (data === "stop") {
      parentPort.removeAllListeners();
    } else {
      handle(data);
    }
  });
})(parentPort);
