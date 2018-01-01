/* eslint-disable no-process-exit, no-console */
import tasks from "./tasks";
import additionalQuestions from "./additional-questions";
import { exec, l, error } from "./util";

const path = require( "path" );
const execa = require( "execa" );
const logSymbols = require( "log-symbols" );
const readPkgUp = require( "read-pkg-up" );
const hasYarn = require( "has-yarn" );
const slash = require( "slash" );
const versionUtils = require( "np/lib/version" );

function getConfig( opts, npmKey, yarnKey ) {
  if ( opts.yarn ) {
    return execa.stdout( "yarn", [ "config", "get", yarnKey ] ).then( o => o.trim() );
  }
  return execa.stdout( "npm", [ "config", "get", npmKey ] ).then( o => o.trim() );
}

function getVersionGitMessage( opts ) {
  return getConfig( opts, "message", "version-git-message" );
}

function getVersionTagPrefix( opts ) {
  return getConfig( opts, "tag-version-prefix", "version-tag-prefix" );
}

function getVersionSignGitTag( opts ) {
  return getConfig( opts, "sign-git-tag", "version-git-sign" ).then( o => o === "true" );
}

function replace( str, { version, pkg: { name } } ) {
  return str.replace( /%s/g, version ).replace( /%n/, name );
}

function replaceDefault( str, { version } ) {
  return str.replace( /%s/g, version );
}

function defaultTasks( opts ) {
  for ( const key in tasks ) {
    if ( opts[ key ] === true || opts[ key ] === undefined ) {
      opts[ key ] = tasks[ key ];
    }
  }
}

function info( message ) {
  console.log( `${logSymbols.info} ${message}` );
}

export { exec, tasks };

export async function publish( opts ) {

  opts = Object.assign( {
    preview: false,
    folder: process.cwd(),
    git: true,
    gitBranch: "master",
    gitCommitHooks: true,
    gitPushHooks: true
  }, opts );

  defaultTasks( opts );

  opts.folder = path.resolve( opts.folder );

  const { pkg, path: pkgPath } = readPkgUp.sync( {
    cwd: opts.folder,
    normalize: false
  } );

  opts.pkg = pkg;

  if ( !opts.pkg ) {
    throw error( "No package.json found. Make sure you're in the correct project." );
  }

  if ( !opts.pkg.name ) {
    throw error( "Missing `name` on package.json." );
  }

  if ( !opts.pkg.version ) {
    throw error( "Missing `version` on package.json." );
  }

  opts.pkgPath = pkgPath;
  opts.pkgNodeModules = path.resolve( pkgPath, "../node_modules" );
  opts.pkgRelativePath = slash( path.relative( process.cwd(), pkgPath ) );

  if ( opts.yarn === undefined ) {
    opts.yarn = hasYarn( opts.folder );
  } else if ( opts.yarn && !hasYarn( opts.folder ) ) {
    throw error( "Could not use Yarn without yarn.lock file" );
  }

  if ( opts.version ) {
    if ( !versionUtils.isValidVersionInput( opts.version ) ) {
      throw error( "Please specify a valid semver, for example, `1.2.3`. See http://semver.org" );
    }
    if ( !versionUtils.isVersionGreater( pkg.version, opts.version ) ) {
      throw error( `Version must be greater than ${pkg.version}` );
    }
    if ( !pkg.private && versionUtils.isPrereleaseVersion( opts.version ) ) {
      if ( !opts.tag ) {
        throw error( "Please specify a tag, for example, `next`." );
      }
      if ( opts.tag === "latest" ) {
        throw error( "It's not possible to publish pre-releases under the `latest` tag. Please specify something else, for example, `next`." );
      }
    }
  } else {
    await additionalQuestions( opts );
  }

  if ( opts.git ) {
    const gitMessagePromise = getVersionGitMessage( opts );
    const gitTagPromise = getVersionTagPrefix( opts );
    const signGitTagPromise = getVersionSignGitTag( opts );
    const gitRootPromise = execa.stdout( "git", [ "rev-parse", "--show-toplevel" ] ).then( o => o.trim() );

    if ( opts.gitMessage ) {
      opts.gitMessage = replace( opts.gitMessage, opts );
    } else {
      opts.gitMessage = replaceDefault( await gitMessagePromise, opts );
    }

    if ( opts.gitTag ) {
      opts.gitTag = replace( opts.gitTag, opts );
    } else {
      opts.gitTag = `${await gitTagPromise}${opts.version}`;
    }

    if ( opts.signGitTag === undefined ) {
      opts.signGitTag = await signGitTagPromise;
    } else {
      opts.signGitTag = !!opts.signGitTag;
    }

    opts.gitRoot = await gitRootPromise;
  }

  console.log();
  info( opts.pkg.name );
  info( opts.version );
  if ( opts.tag ) {
    info( `Tag: ${opts.tag}` );
  }
  info( `Pkg: ${opts.pkgRelativePath}` );
  if ( opts.git ) {
    info( `Git Branch: ${opts.gitBranch}` );
    info( `Git Message: ${opts.gitMessage}` );
    info( `Git Tag: ${opts.gitTag}` );
  }
  info( opts.yarn ? "Using Yarn" : "Using npm" );
  console.log();

  if ( opts.preview ) {
    process.exit( 0 );
  }

  const tasks = l();

  if ( opts.checkSensitiveData ) {
    tasks.add( opts.checkSensitiveData( opts ) );
  }

  if ( opts.checkDeps ) {
    tasks.add( opts.checkDeps( opts ) );
  }

  if ( opts.preCheck ) {
    tasks.add( opts.preCheck( opts ) );
  }

  if ( opts.git && opts.gitCheck ) {
    tasks.add( opts.gitCheck( opts ) );
  }

  if ( opts.cleanup ) {
    tasks.add( opts.cleanup( opts ) );
  }

  if ( opts.build ) {
    tasks.add( opts.build( opts ) );
  }

  if ( opts.test ) {
    tasks.add( opts.test( opts ) );
  }

  if ( opts.bumpVersion ) {
    tasks.add( opts.bumpVersion( opts ) );
  }

  if ( opts.git && opts.gitCommitTag ) {
    tasks.add( opts.gitCommitTag( opts ) );
  }

  if ( opts.publish ) {
    tasks.add( opts.publish( opts ) );
  }

  if ( opts.git && opts.gitPush ) {
    tasks.add( opts.gitPush( opts ) );
  }

  await tasks.run();

  return readPkgUp( {
    cwd: opts.folder,
    normalize: false
  } );
}

export default async function( opts ) {
  try {
    const { pkg } = await publish( opts );
    console.log( `\n ${pkg.name} ${pkg.version} published 🎉` );
  } catch ( err ) {
    if ( err.__generated ) {
      console.error( `\n${logSymbols.error} ${err.message}` );
    } else {
      console.error( `\n${logSymbols.error} ${err.stack}` );
    }
    process.exit( 1 );
  }
}
