import { execPromise, execObservable } from "../util";

// Adapted from https://github.com/sindresorhus/np

const listrInput = require( "listr-input" );
const { throwError, from } = require( "rxjs" );
const { catchError } = require( "rxjs/operators" );
const turbocolor = require( "turbocolor" );

const npmPublish = ( history, opts ) => {
  const args = [ "publish" ];

  if ( opts.tag ) {
    args.push( "--tag", opts.tag );
  }

  if ( opts.otp ) {
    args.push( "--otp", opts.otp );
  }

  return execPromise( "npm", args, {
    cwd: opts.folder,
    history
  } );
};

const handleError = ( history, task, opts, err, message ) => {
  if ( err.stderr.indexOf( "one-time pass" ) !== -1 ) {
    const title = task.title;
    task.title = `${title} ${turbocolor.yellow( "(waiting for input…)" )}`;

    return listrInput( message || "Enter OTP:", {
      done: otp => {
        task.title = title;

        return npmPublish( history, { folder: opts.folder, tag: opts.tag, otp } );
      }
    } ).pipe(
      catchError( err => handleError( history, task, opts, err, "OTP was incorrect, try again:" ) )
    );
  }

  return throwError( err );
};

export default function( history, task, opts ) {
  if ( opts.yarn ) {
    // This will not run "version" again
    // https://github.com/yarnpkg/yarn/pull/3103
    const args = [ "publish", "--new-version", opts.version ];

    if ( opts.tag ) {
      args.push( "--tag", opts.tag );
    }

    if ( opts.access ) {
      args.push( "--access", opts.access );
    }

    return execObservable( "yarn", args, {
      cwd: opts.folder,
      history
    } );
  }
  return from( npmPublish( history, { folder: opts.folder, tag: opts.tag } ) ).pipe(
    catchError( err => handleError( history, task, opts, err ) )
  );
}
