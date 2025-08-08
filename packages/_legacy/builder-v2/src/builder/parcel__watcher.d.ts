declare module "@parcel/watcher" {
  type Options = {
    ignore?: string[];
    backend?: "fs-events" | "watchman" | "windows" | "inotify" | "brute-force";
  };

  type Event = { type: "create" | "update" | "delete"; path: string };

  type Fn = ((err: Error) => void) | ((err: null, events: Event[]) => void);

  type Sub = { unsubscribe(): Promise<void> };

  function writeSnapshot(
    dir: string,
    snapshot: string,
    opts?: Options
  ): Promise<void>;

  function getEventsSince(
    dir: string,
    snapshot: string,
    opts?: Options
  ): Promise<Event[]>;

  function subscribe(dir: string, fn: Fn, opts?: Options): Promise<Sub>;
}
