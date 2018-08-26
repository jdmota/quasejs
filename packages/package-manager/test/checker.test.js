import { Checker } from "../src/commands/check";

const path = require( "path" );

it( "duplicate dependencies in package.json", async() => {

  await expect(
    new Checker().check( path.resolve( __dirname, "test-folders/duplicate-dep" ) )
  ).rejects.toThrowErrorMatchingSnapshot();

} );
