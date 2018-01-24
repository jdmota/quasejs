const findUp = require( "find-up" );
const pkgConf = require( "pkg-conf" );

export function getConfig( opts ) {

  const { cwd, configFiles, configKey, failIfNotFound } = opts || {};
  const result = {
    config: undefined,
    location: undefined
  };

  if ( configFiles ) {
    const location = findUp.sync( configFiles, { cwd } );

    if ( location ) {
      try {
        result.config = require( location );
        result.location = location;
      } catch ( e ) {
        // Ignore
      }
    } else if ( failIfNotFound ) {
      throw new Error( `Config file was not found: ${configFiles.toString()}` );
    }
  }

  if ( !result.config ) {
    if ( configKey ) {
      try {
        result.config = pkgConf.sync( configKey, { cwd, skipOnFalse: true } );
        result.location = "pkg";
      } catch ( e ) {
        // Ignore
      }
    }
  }

  return result;
}
