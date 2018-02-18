/* eslint-disable no-process-exit, no-console */
import tasks from "./tasks";
import additionalQuestions from "./additional-questions";
import { exec, l, error, linkifyIssues, linkifyCommit } from "./util";

const path = require( "path" );
const execa = require( "execa" );
const logSymbols = require( "log-symbols" );
const readPkg = require( "read-pkg" );
const hasYarn = require( "has-yarn" );
const slash = require( "slash" );
const githubUrlFromGit = require( "github-url-from-git" );

const versionRe = /(%s|%v)/g;
const nameRe = /%n/g;

function getConfig( opts, npmKey, yarnKey ) {
  if ( opts.yarn ) {
    return execa.stdout( "yarn", [ "config", "get", yarnKey ] );
  }
  return execa.stdout( "npm", [ "config", "get", npmKey ] );
}

function getVersionGitMessage( opts ) {
  return getConfig( opts, "message", "version-git-message" );
}

function getVersionTagPrefix( opts ) {
  return getConfig( opts, "tag-version-prefix", "version-tag-prefix" );
}

function replace( str, { version, pkg: { name } } ) {
  return str && str.replace( versionRe, version ).replace( nameRe, name );
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
    cwd: process.cwd(),
    folder: process.cwd(),
    git: true,
    gitBranch: "master",
    gitCommitHooks: true
  }, opts );

  defaultTasks( opts );

  opts.folder = path.resolve( opts.folder );
  opts.pkgPath = path.resolve( opts.folder, "package.json" );
  opts.rootPkgPath = path.resolve( opts.cwd, "package.json" );

  opts.pkg = await readPkg( opts.pkgPath );

  if ( opts.pkgPath !== opts.rootPkgPath ) {
    opts.rootPkg = await readPkg( opts.rootPkgPath );
  }

  if ( !opts.pkg ) {
    throw error( "No package.json found. Make sure you're in the correct project." );
  }

  if ( !opts.pkg.name ) {
    throw error( "Missing `name` on package.json." );
  }

  if ( !opts.pkg.version ) {
    throw error( "Missing `version` on package.json." );
  }

  opts.pkgNodeModules = path.resolve( opts.pkgPath, "../node_modules" );
  opts.pkgRelativePath = slash( path.relative( opts.cwd, opts.pkgPath ) );

  if ( opts.yarn === undefined ) {
    opts.yarn = hasYarn( opts.folder );
  } else if ( opts.yarn && !hasYarn( opts.folder ) ) {
    throw error( "Cannot use Yarn without yarn.lock file" );
  }

  if ( opts.git ) {
    opts.gitMessage = opts.gitMessage || await getVersionGitMessage( opts );
    opts.gitTagPrefix = opts.gitTagPrefix || await getVersionTagPrefix( opts );
    opts.gitRoot = await execa.stdout( "git", [ "rev-parse", "--show-toplevel" ] );

    console.log();

    // Show commits
    const repositoryUrl = opts.pkg.repository && opts.pkg.repository.url && githubUrlFromGit( opts.pkg.repository.url );
    const tagPattern = opts.gitTagPrefix.replace( versionRe, "*" ).replace( nameRe, opts.pkg.name ).replace( /\*?$/g, "*" );
    let tag;
    try {
      tag = await execa.stdout( "git", [ "tag", "-l", tagPattern ] );
    } catch ( e ) {
      // Ignore
    }
    if ( tag ) {
      const result = await execa.stdout( "git", [ "log", "--format=%s %h", `refs/tags/${tag}..HEAD`, "--", opts.folder ] );

      if ( !result ) {
        info( `No commits since ${tag}\n` );
        process.exit( 0 );
      }

      const history = result.split( "\n" )
        .map( commit => {
          const commitParts = commit.match( /^(.+)\s([a-f0-9]{7})$/ );
          const commitMessage = repositoryUrl ? linkifyIssues( repositoryUrl, commitParts[ 1 ] ) : commitParts[ 1 ];
          const commitId = repositoryUrl ? linkifyCommit( repositoryUrl, commitParts[ 2 ] ) : commitParts[ 2 ];
          return `- ${commitMessage}  ${commitId}`;
        } )
        .join( "\n" );

      info( `Commits since ${tag}:\n${history || ""}\n` );
    } else {
      info( `No previous git tags found with pattern ${tagPattern}` );
    }
  }

  if ( !opts.version ) {
    await additionalQuestions( opts );
  }

  if ( opts.git ) {
    opts.gitMessage = replace( opts.gitMessage, opts );
    opts.gitTagPrefix = replace( opts.gitTagPrefix, opts );
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
    info( `Git Tag: ${opts.gitTagPrefix}${opts.version}` );
  }
  info( opts.yarn ? "Using Yarn" : "Using npm" );
  console.log();

  if ( opts.preview ) {
    process.exit( 0 );
  }

  const tasks = l();

  [
    opts.checkSensitiveData,
    opts.checkDeps,
    opts.preCheck,
    opts.git && opts.gitCheck,
    opts.cleanup,
    opts.build,
    opts.test,
    opts.rootBeforeVersion,
    opts.bumpVersion,
    opts.rootAfterVersion,
    opts.rootBeforePublish,
    opts.publish,
    opts.rootAfterPublish,
    opts.git && opts.gitPush,
  ].forEach( t => {
    if ( t ) {
      tasks.add( t( opts ) );
    }
  } );

  await tasks.run();

  return readPkg( opts.pkgPath, {
    normalize: false
  } );
}

export default async function( opts ) {
  try {
    const pkg = await publish( opts );
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
