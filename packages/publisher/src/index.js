/* eslint-disable no-process-exit, no-console */
import tasks from "./tasks";
import additionalQuestions from "./additional-questions";
import { isValidVersion } from "./version";
import { exec, l, error, linkifyIssues, linkifyCommit } from "./util";

const path = require( "path" );
const execa = require( "execa" );
const logSymbols = require( "log-symbols" );
const readPkg = require( "read-pkg" );
const hasYarn = require( "has-yarn" );
const slash = require( "slash" );
const inquirer = require( "inquirer" );
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

  defaultTasks( opts );

  opts.folder = path.resolve( opts.folder );
  opts.pkgPath = path.resolve( opts.folder, "package.json" );
  opts.rootPkgPath = path.resolve( opts.cwd, "package.json" );

  const pkgJob = readPkg( opts.pkgPath );
  const rootPkgJob = opts.pkgPath === opts.rootPkgPath ? undefined : readPkg( opts.rootPkgPath );

  opts.pkg = await pkgJob;
  opts.rootPkg = await rootPkgJob;

  opts.pkgNodeModules = path.resolve( opts.pkgPath, "../node_modules" );
  opts.pkgRelativePath = slash( path.relative( opts.cwd, opts.pkgPath ) );

  if ( !opts.pkg ) {
    throw error( "No package.json found. Make sure you're in the correct project." );
  }

  if ( !opts.pkg.name ) {
    throw error( `Missing 'name' on ${opts.pkgRelativePath}` );
  }

  if ( !isValidVersion( opts.pkg.version ) ) {
    throw error( `Missing valid 'version' on ${opts.pkgRelativePath}. If this is the first version, just set it to 0.0.1, e.g.` );
  }

  console.log();
  info( `Current: ${opts.pkg.name}@${opts.pkg.version} [${opts.pkgRelativePath}]` );

  if ( opts.yarn === undefined ) {
    opts.yarn = hasYarn( opts.folder );
  }

  if ( opts.git ) {
    const gitMessageJob = opts.git.commitAndTag ? opts.git.message || getVersionGitMessage( opts ) : undefined;
    const gitTagPrefixJob = opts.git.commitAndTag ? opts.git.tagPrefix || getVersionTagPrefix( opts ) : undefined;
    const gitRootJob = execa.stdout( "git", [ "rev-parse", "--show-toplevel" ] );

    opts.git.message = await gitMessageJob;
    opts.git.tagPrefix = await gitTagPrefixJob;
    opts.git.root = await gitRootJob;

    console.log();

    // Show commits
    const repositoryUrl = opts.pkg.repository && opts.pkg.repository.url && githubUrlFromGit( opts.pkg.repository.url );
    const tagPattern = opts.git.tagPrefix.replace( versionRe, "*" ).replace( nameRe, opts.pkg.name ).replace( /\*?$/g, "*" );
    let tag;
    try {
      tag = await execa.stdout( "git", [ "tag", "-l", tagPattern ] );
    } catch ( e ) {
      // Ignore
    }
    if ( tag ) {
      const result = await execa.stdout( "git", [ "log", "--format=%s %h", `refs/tags/${tag}..HEAD`, "--", opts.folder ] );

      if ( result ) {
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
        const answers = await inquirer.prompt( [ {
          type: "confirm",
          name: "confirm",
          message: "No commits found since previous release, continue?",
          default: false
        } ] );

        if ( !answers.confirm ) {
          process.exit( 0 );
        }
      }
    } else {
      info( `No previous git tags found with pattern ${tagPattern}` );
    }
  }

  if ( !opts.version ) {
    await additionalQuestions( opts );
  }

  if ( opts.git ) {
    opts.git.message = replace( opts.git.message, opts );
    opts.git.tagPrefix = replace( opts.git.tagPrefix, opts );
  }

  console.log();
  info( opts.pkg.name );
  info( opts.version );
  if ( opts.tag ) {
    info( `Tag: ${opts.tag}` );
  }
  info( `Pkg: ${opts.pkgRelativePath}` );
  if ( opts.git ) {
    info( `Git Branch: ${opts.git.branch}` );
    info( `Git Message: ${opts.git.message}` );
    info( `Git Tag: ${opts.git.tagPrefix}${opts.version}` );
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
    opts.commitAndTag,
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
