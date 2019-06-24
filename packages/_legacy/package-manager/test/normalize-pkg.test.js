import { read as readPkg } from "../src/pkg";

const path = require( "path" );
const folder = path.resolve( __dirname, "test-folders/normalize-pkg" );

it( "normalize package.json", async() => {

  expect( JSON.stringify(
    await readPkg( folder, false, true ), null, 2
  ) ).toMatchSnapshot();

} );
