import { ChildProcessParent, WorkerParent } from "../workers";
import { type FromChild, type FromParent } from "./protocol_example";

const parent = process.argv.includes("child_process")
  ? new ChildProcessParent<FromChild, FromParent>()
  : new WorkerParent<FromChild, FromParent>();

parent.on("message", msg => {
  console.log(msg);
  if (msg.type === "hello") {
    parent.send({
      type: "hello-response",
    });
  } else if (msg.type === "echo") {
    parent.send({
      type: "echo-response",
      value: msg.value,
    });
  } else if (msg.type === "terminate") {
    parent.send({
      type: "bye",
    });
    parent.disconnect();
  } else if (msg.type === "crash") {
    throw new Error("crash");
  }
});
