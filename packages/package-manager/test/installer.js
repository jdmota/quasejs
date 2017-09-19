// @flow

import installer from "../src/installer";

const childProcess = require( "child_process" );
const path = require( "path" );
const store = path.resolve( require( "os" ).homedir(), ".qpm-store-test" );

describe( "installer", () => {

  it( "basic", async() => {
    await installer( path.resolve( __dirname, "test-folders/package" ), { store } );

    // $FlowFixMe
    const p = childProcess.fork( path.resolve( __dirname, "test-folders/package/index.js" ), {
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

    expect( str ).toMatchSnapshot();

  } );

} );
