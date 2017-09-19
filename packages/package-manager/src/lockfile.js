// @flow

const path = require( "path" );
const loadJsonFile = require( "load-json-file" );
const writeJsonFile = require( "write-json-file" );

const file = "qpm-lockfile.json";

export async function read( folder: string ): Promise<Object> {
  try {
    return await loadJsonFile( path.resolve( folder, file ) );
  } catch ( e ) {
    if ( e.code === "ENOENT" ) {
      return {};
    }
    throw e;
  }
}

export async function write( folder: string, json: Object ) {
  return writeJsonFile( path.resolve( folder, file ), json );
}
