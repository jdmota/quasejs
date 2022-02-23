// @flow
const path = require( "path" );
const fs = require( "fs-extra" );
const execa = require( "execa" );
const klaw = require( "klaw" );

export function execOnInternal( command, args, folder, internal ) {
  return execa( command, args, {
    cwd: internal
  } );
}

export function execOnFolder( command, args, folder ) {
  return execa( command, args, {
    cwd: folder
  } );
}

export function execOnBoth( [ command1, command2 ], args, folder, internal ) {
  return execOnInternal( command1, args, folder, internal ).then( () => {
    return execOnFolder( command2, [], folder );
  } );
}

export async function copyMaybe( _from: string, to: string, names: string[] ): Promise<void> {
  return Promise.all( names.map( async name => {
    _from = path.join( _from, name );
    to = path.join( to, name );

    let content;

    try {
      content = await fs.readFile( _from );
    } catch ( err ) {
      if ( err.code === "ENOENT" ) {
        return;
      }
      throw err;
    }

    return fs.writeFile( to, content );
  } ) );
}

export async function crawl( folder: string, mapper: Function ): Promise<any> {
  const promises = [];
  await new Promise( ( resolve, reject ) => {
    klaw( folder )
      .on( "data", item => {
        const p = mapper( item );
        if ( p ) {
          promises.push( p );
        }
      } )
      .on( "error", reject )
      .on( "end", resolve );
  } );
  return Promise.all( promises );
}
