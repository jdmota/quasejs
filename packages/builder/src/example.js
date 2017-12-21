import Builder from "./builder";
import plugin from "./plugins/js";

/* eslint-disable no-console */

( async() => {
  try {
    console.log( "Start" );
    const time = Date.now();
    await new Builder( {
      sourceMaps: true,
      context: "packages/builder/test/fixtures/basic/files",
      entries: [ "index.js" ],
      dest: "__dev__/builder_example",
      plugins: [
        plugin( {
          babelOpts: {
            babelrc: false,
            presets: [
              [ "env", {
                targets: { chrome: 50 },
                loose: true
              } ]
            ]
          }
        } )
      ]
    } ).build();
    console.log( Date.now() - time );
  } catch ( e ) {
    console.log( e );
  }
} )();
