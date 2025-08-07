import path from "path";
import { ChildProcessFork, WorkerFork } from "../workers";
import { type FromChild, type FromParent } from "./protocol_example";

const file = path.resolve(import.meta.dirname, "./fork_example.ts");

console.log(
  "Using",
  process.argv.includes("child_process") ? "child_process" : "worker"
);

const child = process.argv.includes("child_process")
  ? new ChildProcessFork<FromParent, FromChild>(
      file,
      ["child_process"],
      {},
      process.execArgv
    )
  : new WorkerFork<FromParent, FromChild>(file, [], {}, process.execArgv);

// child.send({ type: "crash" });

child.send({ type: "hello" });

child.on("message", msg => {
  console.log("message", msg);
  if (msg.type === "hello-response") {
    child.send({
      type: "echo",
      value: 10,
    });
  } else if (msg.type === "echo-response") {
    child.send({
      type: "terminate",
    });
  } else {
    msg;
  }
});

child.on("result", result => {
  console.log("result", result);
});
