import { Installer } from "../src/commands/installer";
import { InstallReporterNoop } from "../src/reporters/installer";
import { testProcess, store } from "./utils";

const fs = require( "fs-extra" );
const path = require( "path" );

// $FlowIgnore
jest.setTimeout( 30000 );

describe( "aliases", () => {

  it( "basic", async() => {

    async function install( moreOpts = {} ) {
      await fs.remove( path.resolve( __dirname, "test-folders/aliases/node_modules" ) );
      await new Installer( {
        preferOffline: true,
        folder: path.resolve( __dirname, "test-folders/aliases" ),
        cache: path.join( store, "cache" ),
        store,
        ...moreOpts
      }, new InstallReporterNoop() ).install();

      const processOutput = await testProcess( path.resolve( __dirname, "test-folders/aliases/index.js" ) );
      const lockfile = await fs.readFile( path.resolve( __dirname, "test-folders/aliases/qpm-lockfile.json" ), "utf8" );
      const bins = await fs.readdir( path.resolve( __dirname, "test-folders/aliases/node_modules/.bin" ) );

      expect( processOutput ).toMatchSnapshot();
      expect( lockfile ).toMatchSnapshot();
      expect( bins ).toMatchSnapshot();
    }

    await fs.remove( path.resolve( __dirname, "test-folders/aliases/qpm-lockfile.json" ) );
    await install();
    await fs.remove( path.resolve( __dirname, "test-folders/aliases/qpm-lockfile.json" ) );

  } );

} );
