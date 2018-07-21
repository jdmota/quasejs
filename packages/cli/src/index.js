import loudRejection from "./loud-rejection";
import notify from "./notify";
import { generateHelp as _generateHelp } from "./help";
import { handleArgs } from "./args";

const path = require( "path" );
const readPkgUp = require( "read-pkg-up" );
const importLocal = require( "import-local" );
const normalizePkg = require( "normalize-package-data" );
const { getConfig, applyDefaults } = require( "@quase/config" );

/* eslint no-process-exit: 0 */
/* eslint no-console: 0 */

// Prevent caching of this module so module.parent is always accurate
delete require.cache[ __filename ];
const filename = module.parent.filename;
const parentDir = path.dirname( filename );

export default async function( _opts ) {
  if ( importLocal( filename ) ) {
    return;
  }
  loudRejection();

  const opts = Object.assign( {
    cwd: process.cwd(),
    inferType: false,
    autoHelp: true,
    autoVersion: true,
    argv: process.argv.slice( 2 )
  }, _opts );

  opts.cwd = path.resolve( opts.cwd );

  const pkgJob = opts.pkg ? Promise.resolve( opts ) : readPkgUp( {
    cwd: parentDir,
    normalize: false
  } );

  const argsInfo = handleArgs( opts );

  const pkg = ( await pkgJob ).pkg;
  normalizePkg( pkg );

  process.title = pkg.bin ? Object.keys( pkg.bin )[ 0 ] : pkg.name;

  const generateHelp = () => _generateHelp( opts, pkg, argsInfo );

  const showHelp = code => {
    console.log( generateHelp() );
    process.exit( typeof code === "number" ? code : 2 );
  };

  const showVersion = () => {
    console.log( typeof opts.version === "string" ? opts.version : pkg.version );
    process.exit();
  };

  const { schema, command, input, flags } = argsInfo;

  if ( flags.version && opts.autoVersion ) {
    showVersion();
  }

  if ( flags.help && opts.autoHelp ) {
    showHelp( 0 );
  }

  const configJob = getConfig( {
    cwd: opts.cwd,
    configFiles: opts.configFiles ? flags.config || opts.configFiles : undefined,
    configKey: opts.configKey,
    failIfNotFound: !!flags.config
  } );

  if ( opts.notifier ) {
    notify( pkg, opts.notifier === true ? {} : opts.notifier );
  }

  const { config, location: configLocation } = await configJob;

  if ( opts.configFiles ) {
    delete flags.config;
  }

  const options = applyDefaults(
    schema,
    [ flags, config ].filter( Boolean ),
    [ "flags", "config" ]
  );

  return {
    command,
    input,
    options,
    flags,
    config,
    configLocation,
    pkg,
    generateHelp,
    showHelp,
    showVersion
  };
}
