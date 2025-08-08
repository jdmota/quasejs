import prettyBytes from "pretty-bytes";
import { relative } from "../utils/path";
import { Builder } from "../builder/builder";
import Logger from "./logger";
import {
  Output,
  BuilderSetupResult,
  BuilderResult,
  BuilderTeardownResult,
} from "../types";

export default class Reporter extends Logger {
  constructor(options = {}, builder: Builder) {
    super(options);

    builder.on("status", message => {
      this.progress(message);
    });

    const showOutput = ({
      filesInfo,
      removedCount,
      time,
      timeCheckpoints,
    }: Output) => {
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
          `Removed ${removedCount} old file${removedCount === 1 ? "" : "s"}.\n`
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
    };

    const onSetupOrTeardown = (
      result: BuilderSetupResult | BuilderTeardownResult
    ) => {
      for (const warning of result.warnings) {
        this.diagnostic(warning);
      }
      if (result.state === "error") {
        for (const error of result.errors) {
          this.diagnostic(error);
        }
      }
    };

    const onResult = (result: BuilderResult) => {
      if (result.state === "interrupted") {
        this.progress("Previous build cancelled...");
      } else {
        for (const warning of result.warnings) {
          this.diagnostic(warning);
        }
        if (result.state === "error") {
          for (const error of result.errors) {
            this.diagnostic(error);
          }
        } else {
          showOutput(result.output);
        }
      }
    };

    builder.on("build-setup", onSetupOrTeardown);
    builder.on("build-result", onResult);
    builder.on("build-teardown", onSetupOrTeardown);

    builder.on("watching", files => {
      this.progress(`Watching ${files.length} files...`);
    });

    builder.on("files-updated", updates => {
      const { added, changed, removed } = updates;
      this.clear();
      if (added.length) {
        this.info("Files added:");
        for (const path of added) {
          this.log(relative(path, builder.options.cwd));
        }
      }
      if (changed.length) {
        this.info("Files changed:");
        for (const path of changed) {
          this.log(relative(path, builder.options.cwd));
        }
      }
      if (removed.length) {
        this.info("Files removed:");
        for (const path of removed) {
          this.log(relative(path, builder.options.cwd));
        }
      }
    });

    builder.on("warning", w => this.diagnostic(w));

    builder.on("hmr-starting", () => {
      this.progress("HMR server starting...");
    });

    builder.on("hmr-started", ({ hostname, port }) => {
      this.persistent(`HMR server listening at ${hostname}:${port}...`);
    });

    builder.on("hmr-error", error => this.diagnostic(error));

    builder.on("sigint", () => {
      this.stopSpinner();
      this.info("Closing...");
    });
  }
}
