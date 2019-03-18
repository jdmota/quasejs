const turbocolor = require( "turbocolor" );
const hasYarn = require( "has-yarn" );

let _updateNotifier: any;
const updateNotifier = () => {
  if ( !_updateNotifier ) {
    try {
      _updateNotifier = require( "update-notifier" );
    } catch ( err ) {
      if ( err.code === "MODULE_NOT_FOUND" ) {
        throw new Error( `If you want to use update-notifier with @quase/cli, you have to install it as well` );
      } else {
        throw err;
      }
    }
  }
  return _updateNotifier;
};

let _boxen: any;
const boxen = () => {
  // update-notifier will include boxen, but just in case...
  if ( !_boxen ) {
    try {
      _boxen = require( "boxen" );
    } catch ( err ) {
      if ( err.code === "MODULE_NOT_FOUND" ) {
        _boxen = ( x: any ) => x;
      } else {
        throw err;
      }
    }
  }
  return _boxen;
};

function notifyFix( opts: any ) {
  // @ts-ignore
  const _this = this as any;

  if ( !process.stdout.isTTY || !_this.update ) {
    return _this;
  }

  opts = Object.assign( {}, opts );

  opts.isGlobal = opts.isGlobal === undefined ? require( "is-installed-globally" ) : opts.isGlobal;

  const defaultMsg = hasYarn() ?
    `Update available ${turbocolor.dim( _this.update.current )}${turbocolor.reset( " → " )}${turbocolor.green( _this.update.latest )}` +
    ` \nRun ${turbocolor.cyan( `yarn ${opts.isGlobal ? "global " : ""}add ${_this.packageName}` )} to update` :
    `Update available ${turbocolor.dim( _this.update.current )}${turbocolor.reset( " → " )}${turbocolor.green( _this.update.latest )}` +
    ` \nRun ${turbocolor.cyan( `npm i ${opts.isGlobal ? "-g " : ""}${_this.packageName}` )} to update`;

  opts.message = opts.message || defaultMsg;

  opts.boxenOpts = opts.boxenOpts === undefined ? {
    padding: 1,
    margin: 1,
    align: "center",
    borderColor: "yellow",
    borderStyle: "round"
  } : opts.boxenOpts;

  let message = "";

  if ( opts.boxenOpts ) {
    message = "\n" + boxen()( opts.message, opts.boxenOpts ) + "\n";
  } else {
    message = "\n" + opts.message + "\n";
  }

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

  return _this;
}

export default function notify( pkg: any, notifierOpts: any ) {
  const notifier = updateNotifier()( Object.assign( { pkg }, notifierOpts.options ) );
  notifier.notify = notifyFix;
  notifier.notify( notifierOpts.notify );
}
