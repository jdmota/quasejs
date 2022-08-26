export class Scheduler {
  private readonly fn: () => void;
  private readonly delay: number;
  private timeoutId: NodeJS.Timeout | null;

  constructor(fn: () => void, delay: number) {
    this.fn = fn;
    this.delay = delay;
    this.timeoutId = null;
  }

  schedule() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.timeoutId = setTimeout(() => {
      this.timeoutId = null;
      this.fn();
    }, this.delay);
  }

  cancel() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}
