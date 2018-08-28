import { Installer } from "../src/commands/installer";
import { InstallReporterNoop } from "../src/reporters/installer";
import { Checker } from "../src/commands/check";
import { CheckReporterNoop } from "../src/reporters/check";
import { testProcess, createStore } from "./utils";

const fs = require( "fs-extra" );
const path = require( "path" );
const store = createStore( "installer" );

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
      }, new InstallReporterNoop() ).install();

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

    await new Checker(
      new CheckReporterNoop()
    ).check( path.resolve( __dirname, "test-folders/package" ) );

    await fs.remove( path.resolve( __dirname, "test-folders/package/qpm-lockfile.json" ) );

  } );

} );
