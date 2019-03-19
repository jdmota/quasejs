import { execPromise, execObservable, error } from "../util/util";
import * as version from "./version";
import { Options, GitOptions } from "../types";

// Adapted from https://github.com/sindresorhus/np

export const versionRe = /(%s|%v)/g;
export const nameRe = /%n/g;

export function createTag( opts: Options & { git: GitOptions & { tagPrefix: string } } ) {
  return opts.git.tagPrefix.replace( versionRe, opts.version ).replace( nameRe, opts.pkg.name ) + opts.version;
}

export function createMessage( opts: Options & { git: GitOptions & { message: string } } ) {
  return opts.git.message.replace( versionRe, opts.version ).replace( nameRe, opts.pkg.name );
}

export async function hasUpstream() {
  const { stdout } = await execPromise( "git", [ "status", "--short", "--branch", "--porcelain=2" ] );
  return /^# branch\.upstream [\w\-/]+$/m.test( stdout );
}

export const currentBranch = async() => {
  const { stdout } = await execPromise( "git", [ "symbolic-ref", "--short", "HEAD" ] );
  return stdout;
};

export const verifyCurrentBranchIsMaster = async( opts: Options & { git: GitOptions } ) => {
  const branch = await currentBranch();
  if ( branch !== opts.git.branch ) {
    throw error(
      `Not on \`${opts.git.branch}\` branch. Use --git.branch to change from which branch you are publishing.`
    );
  }
};

export const isWorkingTreeClean = async() => {
  try {
    const { stdout: status } = await execPromise( "git", [ "status", "--porcelain" ] );
    if ( status !== "" ) {
      return false;
    }
    return true;
  } catch ( _ ) {
    return false;
  }
};

export const verifyWorkingTreeIsClean = async() => {
  if ( !( await isWorkingTreeClean() ) ) {
    throw error( "Unclean working tree. Commit or stash changes first." );
  }
};

const isWin = process.platform === "win32";

export const isRemoteHistoryClean = async() => {
  let history;
  try { // Gracefully handle no remote set up.
    const { stdout } = await execPromise( "git", [ "rev-list", "--count", "--left-only", isWin ? "'@{u}...HEAD'" : "@{u}...HEAD" ] );
    history = stdout;
  } catch ( _ ) {
    // Ignore
  }

  if ( history && history !== "0" ) {
    return false;
  }

  return true;
};

export const verifyRemoteHistoryIsClean = async() => {
  if ( !( await isRemoteHistoryClean() ) ) {
    throw error( "Remote history differs. Please pull changes." );
  }
};

export const verifyRemoteIsValid = async() => {
  try {
    await execPromise( "git", [ "ls-remote", "origin", "HEAD" ] );
  } catch ( error ) {
    throw error( error.stderr.replace( "fatal:", "Git fatal error:" ) );
  }
};

export const fetch = () => execPromise( "git", [ "fetch" ] );

export const tagExistsOnRemote = async( tagName: string ) => {
  try {
    const { stdout: revInfo } = await execPromise( "git", [ "rev-parse", "--quiet", "--verify", `refs/tags/${tagName}` ] );

    if ( revInfo ) {
      return true;
    }

    return false;
  } catch ( error ) {
    // Command fails with code 1 and no output if the tag does not exist, even though `--quiet` is provided
    // https://github.com/sindresorhus/np/pull/73#discussion_r72385685
    if ( error.stdout === "" && error.stderr === "" ) {
      return false;
    }

    throw error;
  }
};

export const verifyTagDoesNotExistOnRemote = async( tagName: string ) => {
  if ( await tagExistsOnRemote( tagName ) ) {
    throw error( `Git tag \`${tagName}\` already exists.` );
  }
};

export const commitLogFromRevision = async( revision: string, relativeFolder: string ) => {
  const MAX = 10;
  const { stdout } = await execPromise( "git", [ "log", `--max-count=${MAX}`, "--format=%s %h", `${revision}..HEAD`, "--", relativeFolder ] );
  return stdout;
};

export const push = ( opts: Options & { git: GitOptions & { push: true } } ) => {
  const args = [ "push", "--follow-tags" ].concat(
    opts.git.pushHooks ? [] : [ "--no-verify" ]
  );
  return execObservable( "git", args, { history: opts.history } );
};

const gitVersion = async() => {
  const { stdout } = await execPromise( "git", [ "version" ] );
  return stdout.match( /git version (\d+\.\d+\.\d+).*/ )[ 1 ];
};

export const verifyRecentGitVersion = async() => {
  if ( version.isLowerThan( await gitVersion(), "2.11.0" ) ) {
    throw error( "Please upgrade to git@2.11.0 or newer." );
  }
};
