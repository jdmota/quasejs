const turbocolor = require( "turbocolor" );
const hasYarn = require( "has-yarn" );
const updateNotifier = require( "update-notifier" );

function notifyFix( opts ) {
  if ( !process.stdout.isTTY || !this.update ) {
    return this;
  }

  opts = Object.assign( {}, opts );

  opts.isGlobal = opts.isGlobal === undefined ? require( "is-installed-globally" ) : opts.isGlobal;

  const defaultMsg = hasYarn() ?
    `Update available ${turbocolor.dim( this.update.current )}${turbocolor.reset( " → " )}${turbocolor.green( this.update.latest )}` +
    ` \nRun ${turbocolor.cyan( `yarn ${opts.isGlobal ? "global " : ""}add ${this.packageName}` )} to update` :
    `Update available ${turbocolor.dim( this.update.current )}${turbocolor.reset( " → " )}${turbocolor.green( this.update.latest )}` +
    ` \nRun ${turbocolor.cyan( `npm i ${opts.isGlobal ? "-g " : ""}${this.packageName}` )} to update`;

  opts.message = opts.message || defaultMsg;

  opts.boxenOpts = opts.boxenOpts || {
    padding: 1,
    align: "center",
    borderStyle: {
      topLeft: " ",
      topRight: " ",
      bottomLeft: " ",
      bottomRight: " ",
      horizontal: " ",
      vertical: " "
    }
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

export default function notify( pkg, notifierOpts ) {
  const notifier = updateNotifier( Object.assign( { pkg }, notifierOpts.options ) );
  notifier.notify = notifyFix;
  notifier.notify( notifierOpts.notify );
}
