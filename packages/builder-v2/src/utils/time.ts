export class Time {
  private startTime: number;
  private time: number;
  private checkpoints: Map<string, number>;

  constructor() {
    this.startTime = 0;
    this.time = 0;
    this.checkpoints = new Map();
  }

  start() {
    this.startTime = this.time = Date.now();
  }

  checkpoint(name: string) {
    const start = this.time;
    this.time = Date.now();
    this.checkpoints.set(name, this.time - start);
  }

  end() {
    return Date.now() - this.startTime;
  }

  getCheckpoints() {
    return this.checkpoints;
  }
}
