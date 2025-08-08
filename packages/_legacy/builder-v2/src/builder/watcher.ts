/// <reference path="parcel__watcher.d.ts" />
import { subscribe, Sub } from "@parcel/watcher";
import { Builder } from "./builder";
import { WatchOptions } from "../types";

export class Watcher {
  private currentSub: Sub | null;

  constructor() {
    this.currentSub = null;
  }

  trackFiles(files: Set<string>) {
    // TODO
  }

  async start(options: WatchOptions, builder: Builder) {
    // TODO
    this.currentSub = await subscribe("TODO", (err, events) => {
      if (err) {
        // TODO
        return;
      }
      for (const { type, path } of events) {
        if (type === "create") {
          builder.fileAdded(path);
        } else if (type === "update") {
          builder.fileChanged(path);
        } else {
          builder.fileRemoved(path);
        }
      }
    });
  }

  async stop() {
    const { currentSub } = this;
    if (currentSub) {
      await currentSub.unsubscribe();
    }
  }
}
