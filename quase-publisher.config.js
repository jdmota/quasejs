const fs = require( "fs-extra" );
const path = require( "path" );
const { execObservable } = require( "./packages/publisher" );

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
      async task( history ) {
        const src = path.join( opts.folder, "src" );
        if ( await fs.pathExists( src ) ) {
          const dist = path.join( opts.folder, "dist" );
          await fs.emptyDir( dist );
          return execObservable( "babel", [ src, "--out-dir", dist, "--copy-files" ], {
            history
          } );
        }
      }
    };
  }
};
