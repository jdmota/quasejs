const path = require( "path" );
const chalk = require( "chalk" );
const hasYarn = require( "has-yarn" );
const updateNotifier = require( "update-notifier" );
const findUp = require( "find-up" );
const readPkgUp = require( "read-pkg-up" );
const pkgConf = require( "pkg-conf" );
const meow = require( "meow" );
const importLocal = require( "import-local" );

function notifyFix( opts ) {
  if ( !process.stdout.isTTY || !this.update ) {
    return this;
  }

  opts = Object.assign( { isGlobal: require( "is-installed-globally" ) }, opts );

  const defaultMsg = hasYarn() ?
    `Update available ${chalk.dim( this.update.current )}${chalk.reset( " → " )}${chalk.green( this.update.latest )}` +
    ` \nRun ${chalk.cyan( `yarn ${opts.isGlobal ? "global " : ""}add ${this.packageName}` )} to update` :
    `Update available ${chalk.dim( this.update.current )}${chalk.reset( " → " )}${chalk.green( this.update.latest )}` +
    ` \nRun ${chalk.cyan( `npm i ${opts.isGlobal ? "-g " : ""}${this.packageName}` )} to update`;

  opts.message = opts.message || defaultMsg;

  opts.boxenOpts = opts.boxenOpts || {
    padding: 1,
    margin: 1,
    align: "center",
    borderColor: "yellow",
    borderStyle: "round"
  };

  const message = "\n" + require( "boxen" )( opts.message, opts.boxenOpts );

  /* eslint-disable */
  if ( opts.defer === false ) {
    console.error( message );
  } else {
    process.on( "exit", () => {
      console.error( message );
    } );

    process.on( "SIGINT", () => {
      console.error( "" );
      process.exit();
    } );
  }
  /* eslint-enable */

  return this;
}

function notify( pkg, notifierOpts ) {
  const notifier = updateNotifier( Object.assign( { pkg }, notifierOpts.options ) );
  notifier.notify = notifyFix;
  notifier.notify( notifierOpts.notify );
}

// Prevent caching of this module so module.parent is always accurate
delete require.cache[ __filename ];
const filename = module.parent.filename;
const parentDir = path.dirname( filename );

export function getConfig( opts ) {

  const { cwd, configFiles, configKey } = opts || {};
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

export default function( callback, opts, notifierOpts ) {

  if ( importLocal( filename ) ) {
    return;
  }

  opts = Object.assign( {}, opts );
  opts.cwd = opts.cwd ? path.resolve( opts.cwd ) : process.cwd();

  const defaultConfigFile = opts.defaultConfigFile;
  const configKey = opts.configKey;

  if ( defaultConfigFile ) {
    opts.flags = Object.assign( {}, opts.flags );
    opts.flags.config = {
      type: "string",
      alias: "c",
      default: defaultConfigFile
    };
  }

  if ( !opts.pkg ) {
    opts.pkg = readPkgUp.sync( {
      cwd: parentDir,
      normalize: false
    } ).pkg;
  }

  const cli = meow( opts );

  if ( notifierOpts !== false ) {
    notify( cli.pkg, notifierOpts || {} );
  }

  const { config, location: configLocation } = getConfig( {
    cwd: opts.cwd,
    configFiles: cli.flags.config,
    configKey
  } );

  cli.config = config;
  cli.configLocation = configLocation;

  cli.options = Object.assign( {}, cli.config, cli.flags );
  delete cli.options.config;
  delete cli.options.c;

  callback( cli );
}
