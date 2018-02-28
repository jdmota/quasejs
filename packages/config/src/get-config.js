const findUp = require( "find-up" );
const pkgConf = require( "pkg-conf" );

export async function getConfig( opts ) {

  const { cwd, configFiles, configKey, failIfNotFound } = opts || {};
  const result = {
    config: undefined,
    location: undefined
  };

  if ( configFiles && configFiles.length ) {
    const location = await findUp( configFiles, { cwd } );

    if ( location ) {
      const e = require( location );
      result.config = e && e.__esModule ? e.default : e;
      result.location = location;
    } else if ( failIfNotFound ) {
      throw new Error( `Config file was not found: ${configFiles.toString()}` );
    }
  }

  if ( !result.config && configKey ) {
    result.config = await pkgConf( configKey, { cwd, skipOnFalse: true } );
    result.location = "pkg";
  }

  return result;
}
