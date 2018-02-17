/* eslint-disable no-process-exit, no-console */
import tasks from "./tasks";
import additionalQuestions from "./additional-questions";
import { exec, l, error } from "./util";

const path = require( "path" );
const execa = require( "execa" );
const logSymbols = require( "log-symbols" );
const readPkg = require( "read-pkg" );
const hasYarn = require( "has-yarn" );
const slash = require( "slash" );
const githubUrlFromGit = require( "github-url-from-git" );
const versionUtils = require( "np/lib/version" );
const util = require( "np/lib/util" );

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

function getVersionSignGitTag( opts ) {
  return getConfig( opts, "sign-git-tag", "version-git-sign" ).then( o => o === "true" );
}

function replace( str, { version, pkg: { name } } ) {
  return str.replace( /%s/g, version ).replace( /%n/, name );
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
  opts.pkgPath = path.resolve( opts.folder, "package.json" );

  const pkg = await readPkg( opts.pkgPath );

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

  opts.pkgNodeModules = path.resolve( opts.pkgPath, "../node_modules" );
  opts.pkgRelativePath = slash( path.relative( process.cwd(), opts.pkgPath ) );

  if ( opts.yarn === undefined ) {
    opts.yarn = hasYarn( opts.folder );
  } else if ( opts.yarn && !hasYarn( opts.folder ) ) {
    throw error( "Cannot use Yarn without yarn.lock file" );
  }

  if ( opts.git ) {
    if ( !opts.gitMessage ) {
      opts.gitMessage = await getVersionGitMessage( opts );
    }
    if ( !opts.gitTag ) {
      opts.gitTag = `${await getVersionTagPrefix( opts )}%s`;
    }
    if ( opts.signGitTag === undefined ) {
      opts.signGitTag = await getVersionSignGitTag( opts );
    } else {
      opts.signGitTag = !!opts.signGitTag;
    }
    opts.gitRoot = await execa.stdout( "git", [ "rev-parse", "--show-toplevel" ] );

    console.log();

    // Show commits
    const repositoryUrl = githubUrlFromGit( pkg.repository.url );
    const tagPattern = opts.gitTag.replace( /(%s|%n)/g, "*" );
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
          const commitMessage = util.linkifyIssues( repositoryUrl, commitParts[ 1 ] );
          const commitId = util.linkifyCommit( repositoryUrl, commitParts[ 2 ] );
          return `- ${commitMessage}  ${commitId}`;
        } )
        .join( "\n" );

      info( `Commits since ${tag}:\n${history || ""}\n` );
    } else {
      info( `No previous git tags found with pattern ${tagPattern}` );
    }
  }

  if ( opts.version ) {
    if ( !versionUtils.isValidVersionInput( opts.version ) ) {
      throw error( `Version should be either ${versionUtils.SEMVER_INCREMENTS.join( ", " )} or a valid semver version.` );
    }

    opts.version = versionUtils.getNewVersion( opts.pkg.version, opts.version );

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
    opts.gitMessage = replace( opts.gitMessage, opts );
    opts.gitTag = replace( opts.gitTag, opts );
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
