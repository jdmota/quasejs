import { Builder } from "./builder";
import { BuildCancelled } from "./build-cancelled";

const _FSWatcher = require("fswatcher-child");

class FSWatcher extends _FSWatcher {
  private closed: boolean;

  constructor(opts: object) {
    super(opts);
    this.closed = false;
  }

  handleEmit(event: string, data: unknown) {
    if (this.closed) {
      return;
    }
    return super.handleEmit(event, data);
  }

  sendCommand(command: string, args: unknown) {
    if (this.closed) {
      return;
    }
    return super.sendCommand(command, args);
  }

  add(paths: string[]) {
    let added = false;
    for (const p of paths) {
      added = this._addPath(p) || added;
    }
    if (added) this.sendCommand("add", [paths]);
  }

  unwatch(paths: string[]) {
    let removed = false;
    for (const p of paths) {
      removed = this.watchedPaths.delete(p) || removed;
    }
    if (removed) this.sendCommand("unwatch", [paths]);
  }

  unwatchDiff(paths: Set<string>) {
    const remove = [];
    for (const p of this.watchedPaths) {
      if (!paths.has(p)) {
        remove.push(p);
      }
    }
    this.unwatch(remove);
  }
}

export default class Watcher {
  private builder: Builder;
  private updates: { path: string; type: "added" | "changed" | "removed" }[];
  private currentBuild: Promise<unknown> | null;
  private rebuildTimeout: NodeJS.Timeout | null;
  private watcher: FSWatcher | null;

  constructor(builder: Builder, testing?: boolean) {
    this.builder = builder;
    this.updates = [];
    this.currentBuild = null;
    this.rebuildTimeout = null;

    if (testing) {
      this.watcher = null;
      return;
    }

    const watcher = (this.watcher = new FSWatcher({
      ignoreInitial: true,
      ignorePermissionErrors: true,
      ignored: /\.cache|\.git/,
      ...builder.options.watchOptions,
    }));

    watcher
      .on("add", (path: string) => this.onUpdate(path, "added"))
      .on("change", (path: string) => this.onUpdate(path, "changed"))
      .on("unlink", (path: string) => this.onUpdate(path, "removed"))
      .on("addDir", (path: string) => this.onUpdate(path, "added"))
      .on("unlinkDir", (path: string) => this.onUpdate(path, "removed"));

    // .on( "error", () => {} )
    // .on( "watcherError", () => {} )
    // .on( "ready", () => {} );
  }

  emit(event: string, value?: unknown) {
    this.builder.emit(event, value);
  }

  _onUpdate(path: string, type: "added" | "changed" | "removed") {
    this.updates.push({ path, type });
    this.emit("update", { path, type });
  }

  onUpdate(path: string, type: "added" | "changed" | "removed") {
    this._onUpdate(path, type);

    if (this.rebuildTimeout) clearTimeout(this.rebuildTimeout);
    this.rebuildTimeout = setTimeout(() => this.queueBuild(), 1000);
  }

  async _queueBuild(prevBuildJob: Promise<unknown>) {
    if (this.updates.length) {
      this.emit("updates", this.updates);
    }

    // Two pre-conditions for calling "runBuild"
    this.builder.cancelBuild();
    await prevBuildJob;

    let update;
    while ((update = this.updates.pop())) {
      this.builder.change(update.path, update.type);
    }

    // Start new build

    try {
      const output = await this.builder.runBuild();
      this.emit("build-success", output);
    } catch (err) {
      if (err instanceof BuildCancelled) {
        this.emit("build-cancelled");
        return;
      }
      this.emit("build-error", err);
    }

    // Update tracked files
    const files = this.builder.watchedFiles();
    const filesArr = Array.from(files);
    const { watcher } = this;
    if (watcher) {
      watcher.add(filesArr);
      watcher.unwatchDiff(files);
    }
    this.emit("watching", filesArr);
  }

  queueBuild() {
    const prev = this.currentBuild || Promise.resolve();
    return (this.currentBuild = this._queueBuild(prev));
  }

  start() {
    this.queueBuild();
    return this;
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.currentBuild = null;
    }
  }
}
