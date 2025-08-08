import { relative } from "../utils/path";
import { Output } from "../types";
import { Builder } from "../builder/builder";
import Logger from "./logger";

const prettyBytes = require("pretty-bytes");

export default class Reporter extends Logger {
  constructor(options = {}, builder: Builder) {
    super(options);

    builder.on("status", message => {
      this.progress(message);
    });

    builder.on(
      "build-success",
      ({ filesInfo, removedCount, time, timeCheckpoints }: Output) => {
        const COLUMNS: { align: "left" | "right" }[] = [
          { align: "left" }, // isEntry
          { align: "left" }, // name
          { align: "right" }, // size
          { align: "left" }, // performance message
        ];

        const { performance, dest } = builder.options;
        const table: (string | number)[][] = [];

        for (const { file, size, isEntry } of filesInfo) {
          if (performance.assetFilter(file)) {
            let message = "";
            if (performance.hints) {
              if (isEntry && size > performance.maxEntrypointSize) {
                message = ` > ${prettyBytes(
                  performance.maxEntrypointSize
                )} [performance!]`;
              } else if (size > performance.maxAssetSize) {
                message = ` > ${prettyBytes(
                  performance.maxAssetSize
                )} [performance!]`;
              }
            }

            table.push([
              isEntry ? "[entry]" : "",
              relative(file, dest),
              prettyBytes(size),
              message,
            ]);
          }
        }

        this.log("");
        this.table(COLUMNS, table);
        this.log("");

        if (removedCount) {
          this.log(
            `Removed ${removedCount} old file${
              removedCount === 1 ? "" : "s"
            }.\n`
          );
        }

        if (this.isTest) {
          this.success("Built!");
        } else {
          const timeStr =
            time < 1000 ? `${time}ms` : `${(time / 1000).toFixed(2)}s`;
          if (timeCheckpoints) {
            this.table([], Array.from(timeCheckpoints));
            this.log("");
          }
          this.success(`Built in ${timeStr}!`);
        }
      }
    );

    builder.on("build-error", (err: string | Error) => this.error(err));

    builder.on("build-cancelled", () => {
      this.progress("Previous build cancelled...");
    });

    builder.on("watching", (files: string[]) => {
      this.progress(`Watching ${files.length} files...`);
    });

    builder.on("updates", (updates: { path: string; type: string }[]) => {
      this.clear();
      for (const { path, type } of updates) {
        this.info(`File ${relative(path, builder.options.cwd)} was ${type}.`);
      }
    });

    builder.on("warning", (w: string | Error) => this.warn(w));

    builder.on("hmr-starting", () => {
      this.progress("HMR server starting...");
    });

    builder.on(
      "hmr-started",
      ({ hostname, port }: { hostname: string; port: number }) => {
        this.persistent(`HMR server listening at ${hostname}:${port}...`);
      }
    );

    builder.on("hmr-error", (w: string | Error) => this.warn(w));

    builder.on("sigint", () => {
      this.stopSpinner();
      this.info("Closing...");
    });
  }
}
