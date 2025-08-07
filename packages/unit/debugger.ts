import type internal from "stream";

const reDebuggerListening = /Debugger listening on (ws:\/\/.+)\r?\n/;
const reDebuggerWaiting = /Waiting for the debugger to disconnect/;

// For help, see: https://nodejs.org/en/learn/getting-started/debugging

export type ListenToDebuggerInFork = (
  onListening: (socket: string) => void,
  onWaitingDisconnect: (socket: string) => void,
  onError: (error: string) => void
) => () => void;

export function listenToDebugger(
  { stderr }: { stderr: internal.Readable },
  onListening: (socket: string) => void,
  onWaitingDisconnect: (socket: string) => void,
  onError: (error: string) => void
) {
  let str = "";
  let socket = "";

  const timeoutId = setTimeout(
    () => onError("Waited for debugger for too long"),
    10000
  );

  function cb(data: string) {
    str += data;
    if (socket) {
      if (reDebuggerWaiting.test(str)) {
        onWaitingDisconnect(socket);
        cleanup();
      }
    } else {
      const m = str.match(reDebuggerListening);
      if (m) {
        socket = m[1];
        clearTimeout(timeoutId);
        onListening(socket);
        cb("");
      }
    }
  }

  stderr.on("data", cb);

  function cleanup() {
    stderr.removeListener("data", cb);
    clearTimeout(timeoutId);
  }

  return cleanup;
}
