const fs = require( "fs-extra" );
const path = require( "path" );
const { exec } = require( "./packages/publisher" );

module.exports = {
  yarn: true,
  gitMessage: "%n: publish %s",
  gitTag: "%n-%s",
  cleanup: false,
  test: false,
  build( opts ) {
    return {
      title: "Build",
      async task() {
        const src = path.join( opts.folder, "src" );
        const dist = path.join( opts.folder, "dist" );
        await fs.emptyDir( dist );
        return exec( "babel", [ src, "--out-dir", dist, "--copy-files" ] );
      }
    };
  },
  publish( opts ) {
    return {
      title: "Publish",
      task() {
        return exec( "yarn", [ "publish", "--access", "public", "--new-version", opts.version ], {
          cwd: opts.folder
        } );
      }
    };
  }
};
