const path = require( "path" );
const chalk = require( "chalk" );
const hasYarn = require( "has-yarn" );
const updateNotifier = require( "update-notifier" );
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

export default function( callback, opts, notifierOpts ) {

  if ( importLocal( filename ) ) {
    return;
  }

  opts = Object.assign( {}, opts );
  opts.cwd = opts.cwd || process.cwd();

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

  if ( cli.flags.config ) {
    const configLocation = path.resolve( opts.cwd, cli.flags.config );

    try {
      cli.config = require( configLocation );
      cli.configLocation = configLocation;
    } catch ( e ) {
      // Ignore
    }
  }

  if ( !cli.config ) {
    if ( configKey ) {
      try {
        cli.config = pkgConf.sync( configKey, { cwd: opts.cwd, skipOnFalse: true } );
        cli.configLocation = "pkg";
      } catch ( e ) {
        // Ignore
      }
    }
  }

  callback( cli );
}
