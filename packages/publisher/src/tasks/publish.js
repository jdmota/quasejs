import { execPromise, execObservable } from "../util";

// Adapted from https://github.com/sindresorhus/np

const listrInput = require( "listr-input" );
const { throwError, from } = require( "rxjs" );
const { catchError } = require( "rxjs/operators" );
const turbocolor = require( "turbocolor" );

const npmPublish = ( history, opts ) => {
  const args = [ "publish" ];

  if ( opts.contents ) {
    args.push( opts.contents );
  }

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

        return npmPublish( history, {
          folder: opts.folder,
          tag: opts.tag,
          contents: opts.contents,
          otp
        } );
      }
    } ).pipe(
      catchError( err => handleError( history, task, opts, err, "OTP was incorrect, try again:" ) )
    );
  }

  return throwError( err );
};

export default function( history, task, opts ) {
  if ( opts.yarn ) {
    const args = [ "publish" ];

    if ( opts.contents ) {
      args.push( opts.contents );
    }

    // This will not run "version" again
    // https://github.com/yarnpkg/yarn/pull/3103
    args.push( "--new-version", opts.version );

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
  return from( npmPublish( history, {
    folder: opts.folder,
    tag: opts.tag,
    contents: opts.contents
  } ) ).pipe(
    catchError( err => handleError( history, task, opts, err ) )
  );
}
