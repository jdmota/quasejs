import { Installer } from "../src/commands/installer";
import { Checker } from "../src/commands/check";

const childProcess = require( "child_process" );
const fs = require( "fs-extra" );
const path = require( "path" );
const store = path.resolve( require( "os" ).homedir(), ".qpm-store-test" );

async function testProcess( file ) {

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

// $FlowIgnore
jest.setTimeout( 30000 );

describe( "installer", () => {

  it( "basic", async() => {

    let outputs = null;

    async function install( moreOpts = {} ) {
      await fs.remove( path.resolve( __dirname, "test-folders/package/node_modules" ) );
      await new Installer( {
        preferOffline: true,
        folder: path.resolve( __dirname, "test-folders/package" ),
        cache: path.join( store, "cache" ),
        store,
        ...moreOpts
      } ).install();

      const processOutput = await testProcess( path.resolve( __dirname, "test-folders/package/index.js" ) );
      const lockfile = await fs.readFile( path.resolve( __dirname, "test-folders/package/qpm-lockfile.json" ), "utf8" );
      const bins = await fs.readdir( path.resolve( __dirname, "test-folders/package/node_modules/.bin" ) );

      if ( outputs ) {
        expect( processOutput ).toEqual( outputs.processOutput );
        expect( lockfile ).toEqual( outputs.lockfile );
        expect( bins ).toEqual( outputs.bins );
      } else {
        outputs = {};
        outputs.processOutput = processOutput;
        outputs.lockfile = lockfile;
        outputs.bins = bins;
        expect( processOutput ).toMatchSnapshot();
        expect( lockfile ).toMatchSnapshot();
        expect( bins ).toMatchSnapshot();
      }
    }

    await fs.emptyDir( store ); // Clean cache

    await fs.remove( path.resolve( __dirname, "test-folders/package/qpm-lockfile.json" ) );

    await install(); // Install without cache and without lockfile

    await install( { frozenLockfile: true } ); // Install with cache and lockfile

    await fs.remove( path.resolve( __dirname, "test-folders/package/qpm-lockfile.json" ) );

    await install(); // Install with cache and without lockfile

    await new Checker().check( path.resolve( __dirname, "test-folders/package" ) );

    await fs.remove( path.resolve( __dirname, "test-folders/package/qpm-lockfile.json" ) );

  } );

} );