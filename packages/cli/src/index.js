const chalk = require( "chalk" );
const hasYarn = require( "has-yarn" );
const updateNotifier = require( "update-notifier" );
const meow = require( "meow" );

function notify( pkg, notifyOpts ) {
  const notifier = updateNotifier( { pkg } );

  if ( notifier.update ) {
    const opts = Object.assign( { isGlobal: true }, notifyOpts );

    if ( !( "message" in opts ) && hasYarn() ) {
      opts.message =
        `Update available ${chalk.dim( notifier.update.current )}${chalk.reset( " → " )}${chalk.green( notifier.update.latest )}` +
        ` \nRun ${chalk.cyan( `yarn ${opts.isGlobal ? "global" : ""} add ` + notifier.packageName )} to update`;
    }

    notifier.notify( opts );
  }
}

export default function( opts, minimistOpts, notifyOpts, callback ) {
  const cli = meow( opts, minimistOpts );

  if ( notifyOpts !== false ) {
    notify( cli.pkg, notifyOpts );
  }

  callback( cli );
}
