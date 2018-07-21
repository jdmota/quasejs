// @flow

const crypto = require( "crypto" );
const fs = require( "fs-extra" );
const klaw = require( "klaw" );

export function isObject( obj: mixed ): boolean {
  return obj != null && typeof obj === "object";
}

export function isEmpty( obj: Object ) {
  for ( const key in obj ) {
    return false;
  }
  return true;
}

export function mapGet<K, V>( map: Map<K, V>, key: K ): V {
  // $FlowIgnore
  return map.get( key );
}

export function hash( input: string ) {
  return crypto.createHash( "md5" ).update( input ).digest( "hex" ).slice( 0, 10 );
}

export async function read( p: string ): Promise<string> {
  try {
    return await fs.readFile( p, "utf8" );
  } catch ( e ) {
    if ( e.code === "ENOENT" ) {
      return "";
    }
    throw e;
  }
}

export async function crawl( folder: string, mapper: Function ): Promise<mixed> {
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
