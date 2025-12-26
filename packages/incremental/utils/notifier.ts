import { createDefer, type Defer } from "../../util/deferred";
import type { ComputationResult } from "./result";

export class Notifier<T> {
  private defer: Defer<void> | null;
  private result: ComputationResult<T> | null;
  private executed: boolean;

  constructor() {
    this.defer = null;
    this.result = null;
    this.executed = false;
  }

  getResult() {
    return this.result;
  }

  done(result: ComputationResult<T> | null) {
    if (this.result !== result) {
      this.result = result;
      // If it is waiting
      if (this.defer != null) {
        if (result != null) {
          this.defer.resolve();
          this.defer = null;
        }
      } else if (this.executed) {
        // We have to invalidate the source
        // if we are not waiting but already executed
        // to ensure others see the result
        // This will rerun the "exec" routine
        return false;
      }
    }
    return true;
  }

  invalidate() {
    // Do not reset result here!
    // The result comes from outside so,
    // the invalidation only serves the purpose
    // of rerunning the "exec" routine
    // so that others see new results
    const { defer } = this;
    this.defer = null;
    this.executed = false;
    if (defer) {
      defer.reject(new Error("Cancel"));
    }
  }

  reset() {
    this.invalidate();
    this.result = null;
  }

  // pre: call this.preExec() first!
  async exec(checkActive: () => void) {
    this.executed = true;
    while (this.result == null) {
      // Ensure this execution is active before doing side-effects
      checkActive();
      const defer = (this.defer = createDefer());
      await defer.promise;
      // In case invalidations occured between notifier.done()
      // and this computation resuming, keep waiting if not done!
    }
    return this.result;
  }
}
