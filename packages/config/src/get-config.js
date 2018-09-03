const findUp = require( "find-up" );
const pkgConf = require( "pkg-conf" );

export function loadConfigFrom( location, arg ) {
  const e = require( location );
  const x = e && e.__esModule ? e.default : e;
  return typeof x === "function" ? x( arg ) : x;
}

export async function getConfig( opts ) {

  const { cwd, configFiles, arg, configKey, failIfNotFound } = opts || {};
  let config, location;

  if ( configFiles && configFiles.length ) {
    const loc = await findUp( configFiles, { cwd } );

    if ( loc ) {
      config = await loadConfigFrom( loc, arg );
      location = loc;
    } else if ( failIfNotFound ) {
      throw new Error( `Config file was not found: ${configFiles.toString()}` );
    }
  }

  if ( !config && configKey ) {
    config = await pkgConf( configKey, { cwd, skipOnFalse: true } );
    location = pkgConf.filepath( config );

    if ( location == null ) {
      config = undefined;
      location = undefined;
    }
  }

  return {
    config,
    location
  };
}
