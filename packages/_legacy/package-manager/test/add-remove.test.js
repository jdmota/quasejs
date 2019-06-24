import { addHelper } from "../src/commands/add";
import { removeHelper } from "../src/commands/remove";

const path = require( "path" );
const folder = path.resolve( __dirname, "test-folders/add-remove" );
const types = [ null, "prod", "dev", "optional" ];

it( "add", async() => {

  for ( const type of types ) {
    const { pkg, added } = await addHelper( {
      folder,
      type
    }, [
      "read-pkg@3.0.0",
      "write@npm:write-pkg@3.0.0",
      "load-json-file",
      "w@npm:write-json-file",
      "write-pkg"
    ] );

    expect( pkg ).toMatchSnapshot( `pkg - ${type}` );
    expect( added ).toMatchSnapshot( `added - ${type}` );
  }

} );

it( "remove", async() => {

  for ( const type of types ) {
    const { pkg, removed } = await removeHelper( {
      folder,
      type
    }, [
      "read-pkg",
      "write-pkg"
    ] );

    expect( pkg ).toMatchSnapshot( `pkg - ${type}` );
    expect( removed ).toMatchSnapshot( `removed - ${type}` );
  }

} );
