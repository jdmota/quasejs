const fs = require( "fs-extra" );

export default async function isFile( file ) {
  try {
    const s = await fs.stat( file );
    return s.isFile() || s.isFIFO();
  } catch ( err ) {
    if ( err.code === "ENOENT" || err.code === "ENOTDIR" ) {
      return false;
    }
    throw err;
  }
}
