import { SourceMapExtractor, SourceMapExtractorBase } from "../src";

const fs = require( "fs-extra" );
const path = require( "path" );

function relative( a, b ) {
  return path.relative( a, b ).replace( /\\/g, "/" );
}

test( "get map from file content", async() => {

  const extractor = new SourceMapExtractorBase();
  const fixturesFolder = path.join( __dirname, "fixtures" );
  const files = await fs.readdir( fixturesFolder );

  for ( const file of files ) {
    if ( /\.map$/.test( file ) ) {
      continue;
    }
    const fileLocation = path.join( __dirname, "fixtures", file );
    const info = extractor.getMapFromFile(
      fileLocation,
      await fs.readFile( fileLocation, "utf8" )
    );

    info.mapLocation = relative( fixturesFolder, info.mapLocation );
    expect( info ).toMatchSnapshot();
  }

} );

test( "get map from file", async() => {

  const extractor = new SourceMapExtractor( fs );
  const fixturesFolder = path.join( __dirname, "fixtures" );
  const files = await fs.readdir( fixturesFolder );

  for ( const file of files ) {
    if ( /\.map$/.test( file ) ) {
      continue;
    }
    const fileLocation = path.join( __dirname, "fixtures", file );
    const info = await extractor.getMap( fileLocation );

    info.mapLocation = relative( fixturesFolder, info.mapLocation );
    expect( info ).toMatchSnapshot();
  }

} );

test( "get original location from map", async() => {

  const extractor = new SourceMapExtractorBase();
  const fixturesFolder = path.join( __dirname, "fixtures" );
  const mapLocation = path.join( fixturesFolder, "map-file-comment.css.map" );
  const map = SourceMapExtractorBase.consumeSourceMap( await fs.readFile( mapLocation, "utf8" ) );

  const location = extractor.getOriginalLocationFromMap( map, mapLocation, {
    line: 8,
    column: 0
  } );

  location.originalFile = relative( fixturesFolder, location.originalFile );
  expect( location ).toMatchSnapshot();

} );
