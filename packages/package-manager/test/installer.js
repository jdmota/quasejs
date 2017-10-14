// @flow

import installer from "../src/installer";

const childProcess = require( "child_process" );
const fs = require( "fs-extra" );
const path = require( "path" );
const store = path.resolve( require( "os" ).homedir(), ".qpm-store-test" );

async function testProcess( file ) {
  // $FlowFixMe
  const p = childProcess.fork( file, {
    stdio: "pipe"
  } );

  let str = "";

  await new Promise( resolve => {
    p.stdout.on( "data", data => {
      str += data;
    } );

    p.stderr.on( "data", data => {
      str += data;
    } );

    p.on( "close", code => {
      str += `\nchild process exited with code ${code}`;
      resolve();
    } );
  } );

  return str;
}

describe( "installer", () => {

  it( "basic", async() => {

    let outputs = null;

    async function install() {
      await fs.remove( path.resolve( __dirname, "test-folders/package/node_modules" ) );
      await installer( path.resolve( __dirname, "test-folders/package" ), { store } );

      const processOutput = await testProcess( path.resolve( __dirname, "test-folders/package/index.js" ) );
      const lockfile = await fs.readFile( path.resolve( __dirname, "test-folders/package/qpm-lockfile.json" ), "utf8" );

      if ( outputs ) {
        expect( processOutput ).toBe( outputs.processOutput );
        expect( lockfile ).toBe( outputs.lockfile );
      } else {
        outputs = {};
        outputs.processOutput = processOutput;
        outputs.lockfile = lockfile;
        expect( processOutput ).toMatchSnapshot();
        expect( lockfile ).toMatchSnapshot();
      }
    }

    await fs.emptyDir( store ); // Clean cache

    await fs.remove( path.resolve( __dirname, "test-folders/package/qpm-lockfile.json" ) );

    await install(); // Install without cache and without lockfile

    await install(); // Install with cache and lockfile

    await fs.remove( path.resolve( __dirname, "test-folders/package/qpm-lockfile.json" ) );

    await install(); // Install with cache and without lockfile

    await fs.remove( path.resolve( __dirname, "test-folders/package/qpm-lockfile.json" ) );

  } );

} );
