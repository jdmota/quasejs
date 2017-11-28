const path = require( "path" );
const chalk = require( "chalk" );
const hasYarn = require( "has-yarn" );
const updateNotifier = require( "update-notifier" );
const meow = require( "meow" );

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

export default function( callback, opts, notifierOpts ) {

  const defaultConfigFile = opts.defaultConfigFile;
  const configKey = opts.configKey;

  if ( defaultConfigFile ) {
    opts = Object.assign( {}, opts );
    opts.flags = Object.assign( {}, opts.flags );
    opts.flags.config = {
      type: "string",
      alias: "c",
      default: defaultConfigFile
    };
  }

  const cli = meow( opts );

  if ( notifierOpts !== false ) {
    notify( cli.pkg, notifierOpts || {} );
  }

  if ( cli.flags.config ) {
    const configLocation = path.resolve( cli.flags.config );

    try {
      cli.config = require( configLocation );
      cli.configLocation = configLocation;
    } catch ( e ) {
      // Ignore
    }
  }

  if ( !cli.config ) {
    const pkgConfig = cli.pkg[ configKey ];
    if ( pkgConfig ) {
      cli.config = pkgConfig;
      cli.configLocation = "pkg";
    }
  }

  callback( cli );
}
