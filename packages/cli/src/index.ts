import hardRejection from "./hard-rejection";
import notify from "./notify";
import { generateHelp as _generateHelp } from "./help";
import { handleArgs } from "./args";
import normalizePkg from "./normalize-pkg";
import { CliOptions } from "./types";

const path = require( "path" );
const readPkgUp = require( "read-pkg-up" );
const importLocal = require( "import-local" );
const quaseConfig = require( "@quase/config" );
const { getConfig } = quaseConfig;

/* eslint no-process-exit: 0 */
/* eslint no-console: 0 */

// Prevent caching of this module so module.parent is always accurate
delete require.cache[ __filename ];
const filename = module.parent && module.parent.filename;
const parentDir = filename && path.dirname( filename );

async function cli( _opts: any ) {
  if ( filename && importLocal( filename ) ) {
    return;
  }
  hardRejection();

  const opts = Object.assign( {
    cwd: process.cwd(),
    inferType: false,
    autoHelp: true,
    autoVersion: true,
    argv: process.argv.slice( 2 )
  }, _opts ) as CliOptions;

  opts.cwd = path.resolve( opts.cwd );

  const pkgJob = opts.pkg ? Promise.resolve( opts ) : readPkgUp( {
    cwd: parentDir,
    normalize: false
  } );

  const argsInfo = handleArgs( opts );

  const pkg = normalizePkg( ( await pkgJob ).pkg );

  process.title = pkg.bin ? Object.keys( pkg.bin )[ 0 ] : pkg.name;

  const generateHelp = () => _generateHelp( opts, pkg, argsInfo );

  const showHelp = ( code?: number ) => {
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

  const flagsCopy = { ...flags };
  if ( opts.configFiles ) {
    delete flagsCopy.config;
  }
  delete flagsCopy.help;
  delete flagsCopy.version;

  flags[ "--" ] = argsInfo[ "--" ];

  const options = schema.validateAndMerge( {}, flagsCopy, config );

  return {
    command: command.value,
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

export { cli, quaseConfig };
export default cli;