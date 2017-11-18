import builder from "../src";

const RUN_SYMLINK = false;

it( "symlink", async() => {

  if ( !RUN_SYMLINK ) {
    return;
  }

  const fs = require( "fs-extra" );

  await fs.remove( "packages/builder/test/_symlink_tmp" );
  await fs.mkdir( "packages/builder/test/_symlink_tmp" );

  await fs.writeFile( "packages/builder/test/_symlink_tmp/file.js", "console.log( 'stuff' );" );

  try {
    await fs.symlink( "packages/builder/test/_symlink_tmp/symlink1", "packages/builder/test/_symlink_tmp/file.js" );
    await fs.symlink( "packages/builder/test/_symlink_tmp/symlink2", "packages/builder/test/_symlink_tmp/symlink1" );
  } catch ( e ) {
    await fs.remove( "packages/builder/test/_symlink_tmp" );
    return;
  }

  await fs.writeFile( "packages/builder/test/_symlink_tmp/index.js", "import a from './symlink2';" );

  console.log( "symlink testing is able to run..." ); // eslint-disable-line no-console

  await builder( {
    cwd: "packages/builder/test/_symlink_tmp",
    sourceMaps: false,
    entries: [
      [ "index.js", "dist.js" ]
    ],
    babelOpts: {
      presets: [
        [ "env", {
          targets: { chrome: 50 },
          loose: true
        } ]
      ]
    }
  } );

  expect( /console.log\(/.test( await fs.readFile( "packages/builder/test/_symlink_tmp/dist.js", "utf8" ) ) ).toBe( true );

  await fs.remove( "packages/builder/test/_symlink_tmp" );

} );
