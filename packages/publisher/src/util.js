require( "any-observable/register/rxjs-all" ); // eslint-disable-line import/no-unassigned-import
const { merge } = require( "rxjs" );
const { filter } = require( "rxjs/operators" );
const streamToObservable = require( "@samverschueren/stream-to-observable" );
const split = require( "split" );
const execa = require( "execa" );
const Listr = require( "listr" );
const issueRegex = require( "issue-regex" );
const terminalLink = require( "terminal-link" );

export function exec( cmd, args, opts ) {
  const cp = execa( cmd, args, opts );

  return merge(
    streamToObservable( cp.stdout.pipe( split() ), { await: cp } ),
    streamToObservable( cp.stderr.pipe( split() ), { await: cp } )
  ).pipe( filter( Boolean ) );
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

export function linkifyCompare( url, a, b ) {
  if ( !url ) {
    return `${a}...${b}`;
  }
  if ( !terminalLink.isSupported ) {
    return `${url}/compare/${a}...${b}`;
  }
  return terminalLink( `${a}...${b}`, `${url}/compare/${a}...${b}` );
}

// Adapted from https://github.com/sindresorhus/np

export function linkifyIssues( url, message ) {
  if ( !url || !terminalLink.isSupported ) {
    return message;
  }
  return message.replace( issueRegex(), issue => {
    const issuePart = issue.replace( "#", "/issues/" );
    if ( issue.startsWith( "#" ) ) {
      return terminalLink( issue, `${url}${issuePart}` );
    }
    const host = url.replace( /\.com\/[^]*$/, ".com/" );
    return terminalLink( issue, `${host}${issuePart}` );
  } );
}

export function linkifyCommit( url, commit ) {
  if ( !url || !terminalLink.isSupported ) {
    return commit;
  }
  return terminalLink( commit, `${url}/commit/${commit}` );
}
