require( "any-observable/register/rxjs-all" ); // eslint-disable-line import/no-unassigned-import
const Observable = require( "any-observable" );
const streamToObservable = require( "stream-to-observable" );
const split = require( "split" );
const execa = require( "execa" );
const Listr = require( "listr" );
const issueRegex = require( "issue-regex" );
const hyperlinker = require( "hyperlinker" );
const supportsHyperlinks = require( "supports-hyperlinks" );

export function exec( cmd, args, opts ) {
  const cp = execa( cmd, args, opts );

  return Observable.merge(
    streamToObservable( cp.stdout.pipe( split() ), { await: cp } ),
    streamToObservable( cp.stderr.pipe( split() ), { await: cp } )
  ).filter( Boolean );
}

export function l( tasks ) {
  return new Listr( tasks || [], {
    // showSubtasks: false
  } );
}

export function error( message ) {
  const err = new Error( message );
  err.__generated = true;
  return err;
}

// Adapted from https://github.com/sindresorhus/np

export function linkifyIssues( url, message ) {
  if ( !supportsHyperlinks.stdout ) {
    return message;
  }
  return message.replace( issueRegex(), issue => {
    const issuePart = issue.replace( "#", "/issues/" );
    if ( issue.startsWith( "#" ) ) {
      return hyperlinker( issue, `${url}${issuePart}` );
    }
    return hyperlinker( issue, `https://github.com/${issuePart}` );
  } );
}

export function linkifyCommit( url, commit ) {
  if ( !supportsHyperlinks.stdout ) {
    return commit;
  }
  return hyperlinker( commit, `${url}/commit/${commit}` );
}
