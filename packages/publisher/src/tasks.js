import { exec, error } from "./util";
import gitTasks from "./git";
import prerequisiteTasks from "./prerequisite";
import publishTask from "./publish";

const path = require( "path" );
const nsp = require( "nsp" );
const del = require( "del" );

const ban = path.join( __dirname, "ban.js" );

export function checkSensitiveData( opts ) {
  return {
    title: "Checking if there is sensitive data",
    task: () => exec( process.execPath, [ ban ], opts.gitRoot || opts.folder )
  };
}

export function checkDeps( opts ) {
  return {
    title: "Checking for the vulnerable dependencies",
    task() {
      return new Promise( ( resolve, reject ) => {
        nsp.check( { package: opts.pkg }, ( err, data ) => {
          if ( err || data.length > 0 ) {
            reject( error( nsp.formatters.summary( err, data ) ) );
          } else {
            resolve();
          }
        } );
      } );
    }
  };
}

export function preCheck( opts ) {
  return {
    title: "Prerequisite check",
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
        return exec( "yarn", [ "install", "--frozen-lockfile", "--production=false" ], {
          cwd: opts.folder
        } ).catch( err => {
          if ( err.stderr.startsWith( "error Your lockfile needs to be updated" ) ) {
            throw error(
              "yarn.lock file is outdated. Run yarn, commit the updated lockfile and try again."
            );
          }
          throw err;
        } );
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
      } )
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
      enabled: () => !!opts.rootPkg,
      skip: () => !!( opts.rootPkg.scripts && opts.rootPkg.scripts[ name ] ),
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
    const args = [ "version", opts.version ];

    if ( opts.git && opts.gitCommitTag ) {
      if ( opts.gitTagPrefix ) {
        args.push( "--version-tag-prefix", opts.gitTagPrefix );
      }
      if ( opts.gitMessage ) {
        args.push( "--version-git-message", opts.gitMessage );
      }
      if ( opts.signGitTag !== undefined ) {
        if ( opts.signGitTag ) {
          args.push( "--version-sign-git-tag" );
        } else {
          args.push( "--no-version-sign-git-tag" );
        }
      }
    } else {
      args.push( "--no-version-git-tag" );
    }

    return {
      title: "Bumping version using Yarn",
      task: () => exec( "yarn", args, {
        cwd: opts.folder
      } )
    };
  }

  const args = [ "version", opts.version ];

  if ( opts.git && opts.gitCommitTag ) {
    if ( opts.gitTagPrefix ) {
      args.push( "--tag-version-prefix", opts.gitTagPrefix );
    }
    if ( opts.gitMessage ) {
      args.push( "--message", opts.gitMessage );
    }
    if ( opts.signGitTag !== undefined ) {
      if ( opts.signGitTag ) {
        args.push( "--sign-git-tag" );
      } else {
        args.push( "--no-sign-git-tag" );
      }
    }
  } else {
    args.push( "--no-git-tag-version" );
  }

  return {
    title: "Bumping version using npm",
    task: () => exec( "npm", args, {
      cwd: opts.folder
    } )
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

export function gitPush() {
  return {
    title: "Pushing commit and tags",
    task: () => exec( "git", [ "push", "--follow-tags" ] )
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
  rootAfterVersion,
  rootBeforePublish,
  publish,
  rootAfterPublish,
  gitPush
};
