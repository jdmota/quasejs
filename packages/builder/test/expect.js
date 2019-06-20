const path = require( "path" );
const fs = require( "fs-extra" );
const klaw = require( "klaw" );
const stripAnsi = require( "strip-ansi" );

export function cleanText( text ) {
  return stripAnsi( text )
    .replace( process.cwd() + path.sep, "" )
    .replace( process.cwd().toLowerCase() + path.sep, "" )
    .replace( /\\/g, "/" );
}

export const UPDATE_SNAPSHOTS = false;

async function isDir( p ) {
  try {
    const s = await fs.stat( p );
    return s.isDirectory();
  } catch ( err ) {
    // Ignore
  }
  return false;
}

async function isFile( p ) {
  try {
    const s = await fs.stat( p );
    return s.isFile();
  } catch ( err ) {
    // Ignore
  }
  return false;
}

function ignoreEndNewLines( buffer ) {
  let len = buffer.length;
  while ( len >= 0 ) {
    if ( buffer[ len - 1 ] === 10 || buffer[ len - 1 ] === 13 ) {
      len--;
    } else {
      break;
    }
  }
  return len;
}

export async function compareFile( actual, expected ) {

  if ( !await isFile( actual ) ) {
    throw new Error( `${actual} is not a file` );
  }

  if ( !await isFile( expected ) ) {
    throw new Error( `${expected} is not a file` );
  }

  const actualBufferP = fs.readFile( actual );
  const expectedBufferP = fs.readFile( expected );

  const actualBuffer = await actualBufferP;
  const expectedBuffer = await expectedBufferP;

  const actualLen = ignoreEndNewLines( actualBuffer );
  const expectedLen = ignoreEndNewLines( expectedBuffer );

  /* if ( actualLen !== expectedLen ) {
    throw new Error( `${actual} size ${actualLen} != ${expected} size ${expectedLen}` );
  }*/

  const len = Math.min( actualLen, expectedLen );

  for ( let i = 0; i < len; i++ ) {
    if ( actualBuffer[ i ] !== expectedBuffer[ i ] ) {
      throw new Error( `${actual} != ${expected} at ${i} / ${actualBuffer[ i ]} !== ${expectedBuffer[ i ]}` );
    }
  }

  return true;
}

// Note: does not detect if the "actual" folder has more files than expected
export async function compareFolders( actual, expected ) {

  if ( !await isDir( actual ) ) {
    throw new Error( `${actual} is not a folder` );
  }

  if ( UPDATE_SNAPSHOTS ) {
    await fs.emptyDir( expected );
    await fs.copy( actual, expected );
    return true;
  }

  if ( !await isDir( expected ) ) {
    throw new Error( `${expected} is not a folder` );
  }

  const stream = klaw( expected );
  const promises = [];
  let error = null;

  for await ( const item of stream ) {
    if ( error ) {
      break;
    }
    if ( item.stats.isFile() ) {
      const actualFile = path.resolve( actual, path.relative( expected, item.path ) );
      promises.push( compareFile( actualFile, item.path ).catch( err => {
        error = err;
        throw err;
      } ) );
    }
  }

  if ( error ) {
    throw error;
  }

  return Promise.all( promises ).then( () => true );
}

/* ( async() => {
  await compareFolders(
    path.resolve( "packages/builder/test/FOLDER_ACTUAL" ),
    path.resolve( "packages/builder/test/FOLDER_EXPECTED" )
  );
} )();*/
