require( "any-observable/register/rxjs-all" ); // eslint-disable-line import/no-unassigned-import
const Observable = require( "any-observable" );
const streamToObservable = require( "stream-to-observable" );
const split = require( "split" );
const execa = require( "execa" );
const Listr = require( "listr" );

export function exec( cmd, args, opts ) {
  const cp = execa( cmd, args, opts );

  return Observable.merge(
    streamToObservable( cp.stdout.pipe( split() ), { await: cp } ),
    streamToObservable( cp.stderr.pipe( split() ), { await: cp } )
  ).filter( Boolean );
}

export function l( tasks ) {
  return new Listr( tasks || [], {
    showSubtasks: false
  } );
}

export function error( message ) {
  const err = new Error( message );
  err.__generated = true;
  return err;
}
