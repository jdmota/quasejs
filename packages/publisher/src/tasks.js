import { exec, error } from "./util";
import gitTasks from "./git";
import prerequisiteTasks from "./prerequisite";

const path = require( "path" );
const nsp = require( "nsp" );
const publishTask = require( "np/lib/publish" );
const execa = require( "execa" );
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
  return {
    title: "Running tests",
    task: () => exec( "npm", [ "test" ], {
      cwd: opts.folder
    } )
  };
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

export function gitCommitTag( opts ) {
  return {
    title: "Git commit and tag",
    task() {
      return execa( "git", [ "add", opts.pkgRelativePath ] )
        .then( () => execa( "git", [ "commit", "-m", opts.gitMessage ].concat( opts.gitCommitHooks ? [] : [ "--no-verify" ] ) ) )
        .then( () => execa( "git", [ "tag", opts.gitTag, opts.signGitTag ? "-sm" : "-am", opts.gitMessage ] ) );
    }
  };
}

export function publish( opts ) {
  return {
    title: "Publishing package",
    task: ( ctx, task ) => publishTask( task, opts.tag ),
    skip() {
      if ( opts.pkg.private ) {
        return "Private package: not publishing to npm.";
      }
    }
  };
}

export function gitPush( opts ) {
  return {
    title: "Pushing commit and tags",
    task: () => exec( "git", [ "push", "--follow-tags" ].concat( opts.gitPushHooks ? [] : [ "--no-verify" ] ) )
  };
}

export default {
  checkSensitiveData,
  checkDeps,
  preCheck,
  gitCheck,
  cleanup,
  test,
  bumpVersion,
  gitCommitTag,
  publish,
  gitPush
};
