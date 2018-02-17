const findUp = require( "find-up" );
const pkgConf = require( "pkg-conf" );

export function getConfig( opts ) {

  const { cwd, configFiles, configKey, failIfNotFound } = opts || {};
  const result = {
    config: undefined,
    location: undefined
  };

  if ( configFiles && configFiles.length ) {
    const location = findUp.sync( configFiles, { cwd } );

    if ( location ) {
      try {
        const e = require( location );
        result.config = e && e.__esModule ? e.default : e;
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
