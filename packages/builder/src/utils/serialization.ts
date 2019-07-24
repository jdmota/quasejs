const v8 = require( "v8" );

function share( contents: Buffer ): SharedArrayBuffer {
  const shared = new SharedArrayBuffer( contents.length );
  const buffer = Buffer.from( shared );
  contents.copy( buffer );
  return shared;
}

const cache = new WeakMap<SharedArrayBuffer, any>();

export function serialize<T>( value: T ) {
  return share( v8.serialize( value ) );
}

export function deserialize<T>( buffer: SharedArrayBuffer ): T {
  let value = cache.get( buffer );
  if ( !value ) {
    value = v8.deserialize( Buffer.from( buffer ) );
    cache.set( buffer, value );
  }
  return value;
}
