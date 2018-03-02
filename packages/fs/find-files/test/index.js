import { findFilesObservable } from "../src";

const path = require( "path" );

function run( patterns ) {
  return new Promise( ( resolve, reject ) => {
    const files = [];
    const visitedDirs = [];

    findFilesObservable( patterns, {
      cwd: path.join( __dirname, "fixtures" ),
      relative: true,
      visitedDirs
    } ).subscribe( {
      error: reject,
      next: x => files.push( x ),
      complete: () => resolve( {
        files: files.sort(),
        visitedDirs: visitedDirs.sort()
      } )
    } );
  } );
}

it( "basic", async() => {

  expect(
    await run( [ "a/**", "!b/**", "c/**" ] )
  ).toMatchSnapshot();

} );
