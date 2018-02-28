const fs = require( "fs-extra" );
const path = require( "path" );
const { exec } = require( "./packages/publisher" );

module.exports = {
  yarn: true,
  git: {
    message: "%n: publish %s",
    tagPrefix: "%n-"
  },
  cleanup: false,
  test: false,
  access: "public",
  gitPush: false,
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
  }
};
