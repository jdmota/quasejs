import { exec, error } from "./util";
import gitTasks from "./git";
import prerequisiteTasks from "./prerequisite";
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
    task: () => exec( process.execPath, [ ban ], ( opts.git && opts.git.root ) || opts.folder )
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
    task: () => prerequisiteTasks( opts )
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
      task: () => del( opts.pkgNodeModules )
    },
    {
      title: "Installing dependencies using Yarn",
      enabled: () => opts.yarn === true,
      task() {
        if ( !hasYarn( opts.folder ) ) {
          Promise.reject( error( "Cannot use Yarn without yarn.lock file" ) );
        }
        return exec( "yarn", [ "install", "--frozen-lockfile", "--production=false" ], {
          cwd: opts.folder
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
      task: () => exec( "npm", [ "install", "--no-package-lock", "--no-production" ], {
        cwd: opts.folder
      } )
    }
  ];
}


export function test( opts ) {
  if ( opts.yarn ) {
    return {
      title: "Running tests using Yarn",
      task: () => exec( "yarn", [ "test" ], {
        cwd: opts.folder
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
    task: () => exec( "npm", [ "test" ], {
      cwd: opts.folder
    } )
  };
}

function buildRootLifecycle( arr, opts ) {
  return arr.map( name => {
    return {
      title: `Executing root's ${name} script using ${opts.yarn ? "Yarn" : "npm"}`,
      enabled: () => !!( opts.rootPkg && opts.rootPkg.scripts && opts.rootPkg.scripts[ name ] ),
      task: () => exec( opts.yarn ? "yarn" : "npm", [ opts.yarn ? "run" : "run-script", name ], {
        cwd: opts.cwd
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
      task: () => exec( "yarn", [ "version", "--new-version", opts.version, "--no-git-tag-version" ], {
        cwd: opts.folder
      } )
    };
  }

  return {
    title: "Bumping version using npm",
    task: () => exec( "npm", [ "version", opts.version, "--no-git-tag-version" ], {
      cwd: opts.folder
    } )
  };
}

export function commitAndTag( opts ) {
  return {
    title: "Commit and tag",
    skip: () => !( opts.git && opts.git.commitAndTag && opts.git.message ),
    task: async() => {
      await execa( "git", [ "add", opts.pkgRelativePath ] );
      await execa( "git", [ "commit", "-m", opts.git.message ].concat( opts.git.commitHooks ? [] : [ "--no-verify" ] ) );
      if ( opts.git.tagPrefix ) {
        await execa( "git", [ "tag", opts.git.tagPrefix + opts.version, opts.git.signTag ? "-sm" : "-am", opts.git.message ] );
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
    task: ( ctx, task ) => publishTask( task, opts ),
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
    task: () => exec( "git", [ "push", "--follow-tags" ].concat( opts.git.pushHooks ? [] : [ "--no-verify" ] ) )
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
