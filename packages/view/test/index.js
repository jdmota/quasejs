import { compiler } from "../src";

const fs = require( "fs-extra" );

it( "view", () => {

  // TODO tests

  fs.writeFileSync( "packages/view/dist/index.html", compiler( fs.readFileSync( "packages/view/test/index.html" ) ) );

} );
