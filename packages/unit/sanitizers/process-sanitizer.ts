import { getStack } from "../../error/errors";
import { getContext } from "./context-tracker";

const PROCESS_EXIT = process.exit;

export function enableExitsTracker() {
  if (process.exit === PROCESS_EXIT) {
    process.exit = () => {
      const error = new Error("Called process.exit");
      const starter = getContext();
      if (starter?.getOptions().sanitize.exit) {
        starter.addError({
          error: "Called process.exit",
          stack: getStack(2),
          user: false,
        });
      }
      throw error;
    };
  }
}

export function disableExitsTracker() {
  process.exit = PROCESS_EXIT;
}

export function exit(code: number) {
  PROCESS_EXIT(code);
}
