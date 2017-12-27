// @flow
import init, { defaultConfig } from "../src/init";

const fs = require( "fs-extra" );
const path = require( "path" );

describe( "init", () => {

  it( "basic", async() => {

    const folder = path.resolve( __dirname, "test-folders/package-init" );

    await fs.emptyDir( folder );

    expect( await init( folder ) ).toMatchSnapshot();

    expect( ( await fs.readdir( folder ) ).sort() ).toEqual( Object.keys( defaultConfig ).sort() );

    expect( await init( folder ) ).toMatchSnapshot();

    await fs.emptyDir( folder );

  } );

} );
