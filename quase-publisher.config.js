const fs = require("fs-extra");
const path = require("path");
const { execObservable } = require("./packages/publisher");

// yarn n packages/publisher/bin --preview --folder <folder>

module.exports = {
  yarn: true,
  access: "public",
  git: {
    message: "%n: publish %s",
    tagPrefix: "%n-",
    push: false,
  },
  tasks: {
    cleanup: false,
    test: false,
    build(opts) {
      return {
        title: "Build",
        async task() {
          const src = path.join(opts.folder, "src");
          if (await fs.pathExists(src)) {
            const dist = path.join(opts.folder, "dist");
            await fs.emptyDir(dist);
            return execObservable(
              "babel",
              [src, "--out-dir", dist, "--copy-files"],
              {
                history: opts.history,
              }
            );
          }
        },
      };
    },
  },
};
