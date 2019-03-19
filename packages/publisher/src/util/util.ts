import "./register-observable";
import History from "../history";

const { merge } = require( "rxjs" );
const { filter } = require( "rxjs/operators" );
const streamToObservable = require( "@samverschueren/stream-to-observable" );
const split = require( "split" );
const execa = require( "execa" );
const Listr = require( "listr" );
const issueRegex = require( "issue-regex" );
const terminalLink = require( "terminal-link" );
const logSymbols = require( "log-symbols" );

type ExecOpts = {
  cwd?: string;
  history?: History;
};

export function errorIgnoreStack( error: any ) {
  error.__generated = true;
  throw error;
}

export async function execPromise( cmd: string, args: string[], opts: ExecOpts = {} ) {
  const { history } = opts;
  const operation = [ cmd ].concat( args );
  try {
    if ( history ) history.start( operation );
    const cp = await execa( cmd, args, opts );
    if ( history ) history.end( operation );
    return cp;
  } catch ( error ) {
    error.__generated = true;
    throw error;
  }
}

export async function execStdout( cmd: string, args: string[], opts: ExecOpts = {} ): Promise<string> {
  const { history } = opts;
  const operation = [ cmd ].concat( args );
  try {
    if ( history ) history.start( operation );
    const cp = await execa.stdout( cmd, args, opts );
    if ( history ) history.end( operation );
    return cp;
  } catch ( error ) {
    error.__generated = true;
    throw error;
  }
}

export function execObservable( cmd: string, args: string[], opts: ExecOpts = {} ) {
  const { history } = opts;
  const operation = [ cmd ].concat( args );
  const cp = execa( cmd, args, opts );

  if ( history ) {
    history.start( operation );
    cp.then( () => history.end( operation ) );
  }

  return merge(
    streamToObservable( cp.stdout.pipe( split() ), { await: cp } ),
    streamToObservable( cp.stderr.pipe( split() ), { await: cp } )
  ).pipe( filter( Boolean ) );
}

export function l( tasks?: any[] ) {
  return new Listr( tasks || [], {
    // showSubtasks: false
  } );
}

export function error( message: string ) {
  const err = new Error( message );
  // @ts-ignore
  err.__generated = true;
  return err;
}

export function linkifyCompare( url: string, a: string, b: string ): string {
  if ( !url ) {
    return `${a}...${b}`;
  }
  if ( !terminalLink.isSupported ) {
    return `${url}/compare/${a}...${b}`;
  }
  return terminalLink( `${a}...${b}`, `${url}/compare/${a}...${b}` );
}

// Adapted from https://github.com/sindresorhus/np

export function linkifyIssues( url: string, message: string ): string {
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

export function linkifyCommit( url: string, commit: string ): string {
  if ( !url || !terminalLink.isSupported ) {
    return commit;
  }
  return terminalLink( commit, `${url}/commit/${commit}` );
}

export function linkifyCommitRange( url: string, commitRange: string ): string {
  if ( !url || !terminalLink.isSupported ) {
    return commitRange;
  }
  return terminalLink( commitRange, `${url}/commit/${commitRange}` );
}

export function info( message: string ) {
  // eslint-disable-next-line no-console
  console.log( `${logSymbols.info} ${message}` );
}
