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
      task() {
        const src = path.join( opts.folder, "src" );
        const dist = path.join( opts.folder, "dist" );
        return exec( "babel", [ src, "--out-dir", dist, "--copy-files" ] );
      }
    };
  },
  publish( opts ) {
    return {
      title: "Publish",
      task() {
        return exec( "yarn", [ "publish", "--access", "public" ], {
          cwd: opts.folder
        } );
      }
    };
  }
};
