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

export default function notify( pkg: any, notifierOpts: any ) {
  const notifier = updateNotifier()( Object.assign( { pkg }, notifierOpts.options ) );
  notifier.notify( notifierOpts.notify );
}
