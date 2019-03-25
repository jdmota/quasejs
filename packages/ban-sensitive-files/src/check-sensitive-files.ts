import { SensitiveFile } from "./types";
import nameToCheck from "./sensitive-files";

const path = require( "path" );
const fs = require( "fs-extra" );

async function read( filename: string ): Promise<string> {
  try {
    return await fs.readFile( filename, "utf8" );
  } catch ( error ) {
    if ( error.code === "ENOENT" ) {
      return "";
    }
    throw error;
  }
}

async function checkForFile( filename: string ): Promise<SensitiveFile | null> {
  const name = path.basename( filename );
  const check = nameToCheck[ name ];
  if ( check ) {
    let text = await read( filename );
    const errors = await check( filename, text );
    text = ""; // Just in case
    if ( errors.length > 0 ) {
      return {
        filename,
        errors
      };
    }
  }
  return null;
}

export default async function( files: string[] ) {
  const jobs = files.map( checkForFile );
  const result = [];
  for ( const job of jobs ) {
    const r = await job;
    if ( r ) {
      result.push( r );
    }
  }
  return result;
}
