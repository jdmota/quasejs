import execa from "execa";
import logSymbols from "log-symbols";
import terminalLink from "terminal-link";
import issueRegex from "issue-regex";
import History from "../history";

const { filter } = require( "rxjs/operators" );
const streamToObservable = require( "@samverschueren/stream-to-observable" );
const split = require( "split" );
const Listr = require( "listr" );

type ExecOpts = {
  cwd?: string;
  history?: History;
  preferLocal?: boolean;
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
    const cp = await execa( cmd, args, {
      preferLocal: true,
      ...opts
    } );
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
    const { stdout } = await execa( cmd, args, {
      preferLocal: true,
      ...opts
    } );
    if ( history ) history.end( operation );
    return stdout;
  } catch ( error ) {
    error.__generated = true;
    throw error;
  }
}

export function execObservable( cmd: string, args: string[], opts: ExecOpts = {} ) {
  const { history } = opts;
  const operation = [ cmd ].concat( args );
  const cp = execa( cmd, args, {
    preferLocal: true,
    ...opts
  } );

  if ( history ) {
    history.start( operation );
    cp.then( () => history.end( operation ) );
  }

  const { all } = cp as any;
  return streamToObservable( all.pipe( split() ) ).pipe( filter( Boolean ) );
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
