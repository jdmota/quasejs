let relative;
function getPlugin( m ) {
  relative = relative || require( "require-relative" );
  return require( relative.resolve( m, process.cwd() ) );
}

export default function( plugin, _default, type, what ) {
  if ( plugin == null ) {
    return _default;
  }
  if ( typeof plugin === "string" ) {
    plugin = getPlugin( plugin );
  }
  if ( typeof plugin === type ) { // eslint-disable-line valid-typeof
    return plugin;
  }
  throw new Error( `Invalid ${what}. Expected ${type} but got ${plugin}` );
}
