import { getContext } from "./context-tracker";

function onWarning(error: Error) {
  const starter = getContext();
  if (starter?.getOptions().sanitize.warnings) {
    starter.addError({
      error,
      stack: "",
      user: false,
    });
  }
}

let enabled = false;

export function enableWarningsTracker() {
  if (!enabled) {
    enabled = true;
    process.on("warning", onWarning);
  }
}

export function disableWarningsTracker() {
  if (enabled) {
    enabled = false;
    process.off("warning", onWarning);
  }
}
