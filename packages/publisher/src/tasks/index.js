import { execPromise, execObservable, error } from "../util";
import gitTasks from "./git-check";
import preTasks from "./pre-check";
import publishTask from "./publish";

const { throwError } = require( "rxjs" );
const { catchError } = require( "rxjs/operators" );

const path = require( "path" );
const del = require( "del" );
const hasYarn = require( "has-yarn" );
const execa = require( "execa" );

const ban = path.join( __dirname, "ban.js" );

export function checkSensitiveData( opts ) {
  return {
    title: "Checking if there is sensitive data",
    task: () => execObservable( process.execPath, [ ban ], {
      cwd: ( opts.git && opts.git.root ) || opts.folder
    } )
  };
}

export function checkDeps( opts ) {
  return {
    title: "Checking for vulnerable dependencies",
    task( ctx, task ) {
      if ( opts.yarn === true ) {
        task.skip( "Yarn does not support audit yet" );
        return;
      }
      return execa.stdout( "npm", [ "audit" ], {
        cwd: opts.folder
      } ).catch( err => {
        if ( /Did you mean/.test( err.stdout ) ) {
          task.skip( "This version of npm does not support audit. Upgrade to npm>=6" );
          return;
        }
        throw err;
      } );
    }
  };
}

export function preCheck( opts ) {
  return {
    title: "Prerequisite check",
    enabled: () => opts.publish,
    task: () => preTasks( opts )
  };
}

export function gitCheck( opts ) {
  return {
    title: "Git",
    task: () => gitTasks( opts )
  };
}

export function cleanup( opts ) {
  return [
    {
      title: "Cleanup",
      task: async history => {
        history.start( "Delete node_modules" );
        await del( opts.pkgNodeModules );
        history.end( "Delete node_modules" );
      }
    },
    {
      title: "Installing dependencies using Yarn",
      enabled: () => opts.yarn === true,
      task( history ) {
        if ( !hasYarn( opts.folder ) ) {
          return Promise.reject( error( "Cannot use Yarn without yarn.lock file" ) );
        }
        return execObservable( "yarn", [ "install", "--frozen-lockfile", "--production=false" ], {
          cwd: opts.folder,
          history
        } ).pipe(
          catchError( err => {
            if ( err.stderr.startsWith( "error Your lockfile needs to be updated" ) ) {
              throwError(
                error(
                  "yarn.lock file is outdated. Run yarn, commit the updated lockfile and try again."
                )
              );
            }
            throwError( err );
          } )
        );
      }
    },
    {
      title: "Installing dependencies using npm",
      enabled: () => opts.yarn === false,
      task: history => execObservable( "npm", [ "install", "--no-package-lock", "--no-production" ], {
        cwd: opts.folder,
        history
      } )
    }
  ];
}


export function test( opts ) {
  if ( opts.yarn ) {
    return {
      title: "Running tests using Yarn",
      task: history => execObservable( "yarn", [ "test" ], {
        cwd: opts.folder,
        history
      } ).pipe(
        catchError( err => {
          if ( err.message.includes( 'Command "test" not found' ) ) {
            return [];
          }
          throwError( err );
        } )
      )
    };
  }
  return {
    title: "Running tests using npm",
    task: history => execObservable( "npm", [ "test" ], {
      cwd: opts.folder,
      history
    } )
  };
}

function buildRootLifecycle( arr, opts ) {
  return arr.map( name => {
    return {
      title: `Executing root's ${name} script using ${opts.yarn ? "Yarn" : "npm"}`,
      enabled: () => !!( opts.rootPkg && opts.rootPkg.scripts && opts.rootPkg.scripts[ name ] ),
      task: history => execObservable( opts.yarn ? "yarn" : "npm", [ opts.yarn ? "run" : "run-script", name ], {
        cwd: opts.cwd,
        history
      } )
    };
  } );
}

export function rootBeforeVersion( opts ) {
  return buildRootLifecycle( [ "preversion" ], opts );
}

export function bumpVersion( opts ) {
  if ( opts.yarn ) {
    return {
      title: "Bumping version using Yarn",
      task: history => execObservable( "yarn", [ "version", "--new-version", opts.version, "--no-git-tag-version" ], {
        cwd: opts.folder,
        history
      } )
    };
  }

  return {
    title: "Bumping version using npm",
    task: history => execObservable( "npm", [ "version", opts.version, "--no-git-tag-version" ], {
      cwd: opts.folder,
      history
    } )
  };
}

export function commitAndTag( opts ) {
  return {
    title: "Commit and tag",
    skip: () => !( opts.git && opts.git.commitAndTag && opts.git.message ),
    task: async history => {
      const commitArgs = [ "commit" ];
      if ( opts.git.signCommit ) {
        commitArgs.push( "-S" );
      }
      commitArgs.push( "-m" );
      commitArgs.push( opts.git.message );
      if ( !opts.git.commitHooks ) {
        commitArgs.push( "--no-verify" );
      }

      await execPromise( "git", [ "add", opts.pkgRelativePath ], { history } );
      await execPromise( "git", commitArgs, { history } );
      if ( opts.git.tagPrefix ) {
        await execPromise( "git", [ "tag", opts.git.tagPrefix + opts.version, opts.git.signTag ? "-sm" : "-am", opts.git.message ], { history } );
      }
    }
  };
}

export function rootAfterVersion( opts ) {
  return buildRootLifecycle( [ "postversion" ], opts );
}

export function rootBeforePublish( opts ) {
  return buildRootLifecycle( [ "prepublish", "prepare", "prepublishOnly" ], opts );
}

export function publish( opts ) {
  return {
    title: `Publishing package using ${opts.yarn ? "Yarn" : "npm"}`,
    task: ( history, task ) => publishTask( history, task, opts ),
    skip() {
      if ( opts.pkg.private ) {
        return "Private package: not publishing to npm.";
      }
    }
  };
}

export function rootAfterPublish( opts ) {
  return buildRootLifecycle( [ "publish", "postpublish" ], opts );
}

export function gitPush( opts ) {
  return {
    title: "Pushing commit and tags",
    task: history => execObservable( "git", [ "push", "--follow-tags" ].concat( opts.git.pushHooks ? [] : [ "--no-verify" ] ), { history } )
  };
}

export default {
  checkSensitiveData,
  checkDeps,
  preCheck,
  gitCheck,
  cleanup,
  test,
  rootBeforeVersion,
  bumpVersion,
  commitAndTag,
  rootAfterVersion,
  rootBeforePublish,
  publish,
  rootAfterPublish,
  gitPush
};
