import { getContext } from "./context-tracker";

function onError(error: Error) {
  const starter = getContext();
  starter?.addError({
    error,
    stack: "",
    user: false,
  });
}

let enabled = false;

export function enableUncaughtErrorsTracker() {
  if (!enabled) {
    enabled = true;
    process.on("uncaughtException", onError);
    process.on("unhandledRejection", onError);
  }
}

export function disableUncaughtErrorsTracker() {
  if (enabled) {
    enabled = false;
    process.off("uncaughtException", onError);
    process.off("unhandledRejection", onError);
  }
}
