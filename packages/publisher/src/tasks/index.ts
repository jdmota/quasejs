import { Options, GitOptions } from "../types";
import { execPromise, execObservable, l, error, execStdout } from "../util/util";
import * as git from "../util/git";
import * as npm from "../util/npm";
import * as version from "../util/version";
import preTasks from "./pre-check";
import publishTask from "./publish";

const { throwError } = require( "rxjs" );
const { catchError } = require( "rxjs/operators" );

const del = require( "del" );
const hasYarn = require( "has-yarn" );

export function checkVersions( opts: Options ) {
  return [
    {
      title: "Check npm version",
      enabled: () => !opts.yarn,
      task: () => npm.verifyRecentNpmVersion()
    },
    {
      title: "Check yarn version",
      enabled: () => opts.yarn,
      task: async() => {
        const yarnVersion = await execStdout( "yarn", [ "--version" ] );

        if ( version.satisfies( yarnVersion, "<1.7.0" ) ) {
          throw error( "Please upgrade to yarn@1.7.0 or newer" );
        }
      }
    },
    {
      title: "Check git version",
      enabled: () => opts.git.check,
      task: () => git.verifyRecentGitVersion()
    },
  ];
}

export function checkDeps( opts: Options ) {
  return {
    title: "Checking for vulnerable dependencies",
    task( _ctx: any, task: any ) {
      return execStdout( opts.yarn ? "yarn" : "npm", [ "audit" ], {
        cwd: opts.folder
      } ).catch( ( err: Error & { stdout: string; stderr: string } ) => {
        if ( /(Did you mean|npm <command>)/.test( err.stdout ) ) {
          task.skip( "This version of npm does not support audit. Upgrade to npm>=6" );
          return;
        }
        if ( /Command "audit" not found/.test( err.stderr ) ) {
          task.skip( "This version of yarn does not support audit. Upgrade to yarn>=1.12" );
          return;
        }
        throw err;
      } );
    }
  };
}

export function preCheck( opts: Options ) {
  return {
    title: "Prerequisite check",
    enabled: () => opts.publish,
    task: () => preTasks( opts )
  };
}

export function gitCheck( opts: Options ) {
  return {
    title: "Git",
    enabled: () => opts.git.check,
    task: () => l( [
      {
        title: "Check current branch",
        task: () => git.verifyCurrentBranchIsMaster( opts )
      },
      {
        title: "Check local working tree",
        task: () => git.verifyWorkingTreeIsClean()
      },
      {
        title: "Check remote history",
        task: () => git.verifyRemoteHistoryIsClean()
      }
    ] )
  };
}

export function cleanup( opts: Options ) {
  return [
    {
      title: "Cleanup",
      skip: () => opts.hasNpmLockfile,
      task: async() => {
        const op = [ "Delete node_modules" ];
        opts.history.start( op );
        await del( opts.pkgNodeModules );
        opts.history.end( op );
      }
    },
    {
      title: "Installing dependencies using Yarn",
      enabled: () => opts.yarn,
      task: () => {
        if ( !hasYarn( opts.folder ) ) {
          return Promise.reject( error( "Cannot use Yarn without yarn.lock file" ) );
        }
        return execObservable( "yarn", [ "install", "--frozen-lockfile", "--production=false" ], {
          cwd: opts.folder,
          history: opts.history
        } ).pipe(
          catchError( ( err: Error & { stderr: string } ) => {
            if ( err.stderr.startsWith( "error Your lockfile needs to be updated" ) ) {
              return throwError(
                error(
                  "yarn.lock file is outdated. Run yarn, commit the updated lockfile and try again."
                )
              );
            }
            return throwError( err );
          } )
        );
      }
    },
    {
      title: "Installing dependencies using npm",
      enabled: () => !opts.yarn,
      task: () => {
        const args = opts.hasNpmLockfile ? [ "ci" ] : [ "install", "--no-package-lock", "--no-production" ];
        return execObservable( "npm", args, {
          cwd: opts.folder,
          history: opts.history
        } );
      }
    }
  ];
}

export function test( opts: Options ) {
  if ( opts.yarn ) {
    return {
      title: "Running tests using Yarn",
      task: () => execObservable( "yarn", [ "test" ], {
        cwd: opts.folder,
        history: opts.history
      } ).pipe(
        catchError( ( err: Error ) => {
          if ( err.message.includes( 'Command "test" not found' ) ) {
            return [];
          }
          return throwError( err );
        } )
      )
    };
  }
  return {
    title: "Running tests using npm",
    task: () => execObservable( "npm", [ "test" ], {
      cwd: opts.folder,
      history: opts.history
    } )
  };
}

function buildRootLifecycle( arr: string[], opts: Options ) {
  return arr.map( name => {
    return {
      title: `Executing root's ${name} script using ${opts.yarn ? "Yarn" : "npm"}`,
      enabled: () => !!( opts.rootPkg && opts.rootPkg.scripts && opts.rootPkg.scripts[ name ] ),
      task: () => execObservable( opts.yarn ? "yarn" : "npm", [ opts.yarn ? "run" : "run-script", name ], {
        cwd: opts.cwd,
        history: opts.history
      } )
    };
  } );
}

export function rootBeforeVersion( opts: Options ) {
  return buildRootLifecycle( [ "preversion" ], opts );
}

export function bumpVersion( opts: Options ) {
  if ( opts.yarn ) {
    return {
      title: "Bumping version using Yarn",
      task: () => execObservable( "yarn", [ "version", "--new-version", opts.version, "--no-git-tag-version" ], {
        cwd: opts.folder,
        history: opts.history
      } )
    };
  }

  return {
    title: "Bumping version using npm",
    task: () => execObservable( "npm", [ "version", opts.version, "--no-git-tag-version" ], {
      cwd: opts.folder,
      history: opts.history
    } )
  };
}

export function commitAndTag( opts: Options ) {
  return {
    title: "Commit and tag",
    skip: () => !opts.git.commitAndTag,
    task: async() => {
      if ( !opts.git.commitAndTag ) return;
      const message = git.createMessage( opts as Options & { git: GitOptions & { message: string } } );
      const tag = git.createTag( opts as Options & { git: GitOptions & { tagPrefix: string } } );

      const commitArgs = [ "commit" ];
      if ( opts.git.signCommit ) {
        commitArgs.push( "-S" );
      }
      commitArgs.push( "-m" );
      commitArgs.push( message );
      if ( !opts.git.commitHooks ) {
        commitArgs.push( "--no-verify" );
      }

      const execOpts = { history: opts.history };

      await execPromise( "git", [ "add", opts.pkgRelativePath ], execOpts );
      await execPromise( "git", commitArgs, execOpts );

      if ( opts.git.commitAndTag !== "only-commit" ) {
        await execPromise( "git", [ "tag", tag, opts.git.signTag ? "-sm" : "-am", message ], execOpts );
      }
    }
  };
}

export function rootAfterVersion( opts: Options ) {
  return buildRootLifecycle( [ "postversion" ], opts );
}

export function rootBeforePublish( opts: Options ) {
  return buildRootLifecycle( [ "prepublish", "prepare", "prepublishOnly" ], opts );
}

export function publish( opts: Options ) {
  return {
    title: `Publishing package using ${opts.yarn ? "Yarn" : "npm"}`,
    skip() {
      if ( !opts.publish ) {
        return true;
      }
      if ( opts.pkg.private ) {
        return "Private package: not publishing to npm.";
      }
    },
    task: ( _: any, task: any ) => publishTask( task, opts )
  };
}

export function rootAfterPublish( opts: Options ) {
  return buildRootLifecycle( [ "publish", "postpublish" ], opts );
}

export function gitPush( opts: Options ) {
  return {
    title: opts.git.commitAndTag === "only-commit" ? "Pushing commit" : "Pushing commit and tag",
    skip: async() => {
      if ( !opts.git.commitAndTag ) {
        return true;
      }
      if ( !opts.git.push ) {
        return true;
      }
      if ( !( await git.hasUpstream() ) ) {
        return "Upstream branch not found: not pushing.";
      }
    },
    task: () => git.push( opts as Options & { git: GitOptions & { push: true } } )
  };
}
