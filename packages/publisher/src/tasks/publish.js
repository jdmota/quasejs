import { execPromise } from "../util";

// Adapted from https://github.com/sindresorhus/np

const listrInput = require( "listr-input" );
const { throwError, from } = require( "rxjs" );
const { catchError } = require( "rxjs/operators" );
const turbocolor = require( "turbocolor" );

const publish = ( history, opts ) => {
  const args = [ "publish" ];

  if ( opts.contents ) {
    args.push( opts.contents );
  }

  if ( opts.yarn ) {
    // This will not run "version" again
    // https://github.com/yarnpkg/yarn/pull/3103
    args.push( "--new-version", opts.version );
  }

  if ( opts.tag ) {
    args.push( "--tag", opts.tag );
  }

  if ( opts.access ) {
    args.push( "--access", opts.access );
  }

  if ( opts.otp ) {
    args.push( "--otp", opts.otp );
  }

  return execPromise( opts.yarn ? "yarn" : "npm", args, {
    cwd: opts.folder,
    history
  } );
};

const handleError = ( history, task, opts, err, message ) => {
  if ( err.stderr.includes( "one-time pass" ) || err.message.includes( "user TTY" ) ) {
    const title = task.title;
    task.title = `${title} ${turbocolor.yellow( "(waiting for input…)" )}`;

    return listrInput( message || "Enter OTP:", {
      done: otp => {
        task.title = title;

        return publish( history, {
          yarn: opts.yarn,
          folder: opts.folder,
          tag: opts.tag,
          access: opts.access,
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
  return from( publish( history, {
    yarn: opts.yarn,
    folder: opts.folder,
    tag: opts.tag,
    access: opts.access,
    contents: opts.contents
  } ) ).pipe(
    catchError( err => handleError( history, task, opts, err ) )
  );
}
