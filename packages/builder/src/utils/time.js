const map = new Map();

export function timeStart( name ) {
  map.set( name, Date.now() );
}

export function timeEnd( name ) {
  const time = map.get( name );
  console.log( `--- Performance ${name}: ${Date.now() - time}ms ---` ); // eslint-disable-line
  map.delete( name );
}
