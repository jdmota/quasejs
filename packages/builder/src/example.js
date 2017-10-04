import Builder from "./builder";
import { plugin, resolver, checker, renderer } from "./plugins/js";

/* eslint-disable no-console */

( async() => {
  try {
    console.log( "Start" );
    const time = Date.now();
    await new Builder( {
      sourceMaps: true,
      fs: {
        writeFile() {
          console.log( arguments );
        },
        mkdirp() {

        }
      },
      entries: [
        [ "./packages/builder/test/fixtures/basic/files/index.js", "example.output.txt" ]
      ],
      plugins: [
        plugin()
      ],
      resolvers: [
        resolver(),
      ],
      checkers: [
        checker()
      ],
      renderers: [
        renderer( {
          babelrc: false,
          presets: [
            [ "env", {
              targets: { chrome: 50 },
              loose: true
            } ]
          ]
        } )
      ]
    } ).build();
    console.log( Date.now() - time );
  } catch ( e ) {
    console.log( e );
  }
} )();
