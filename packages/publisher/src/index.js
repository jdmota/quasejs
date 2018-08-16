/* eslint-disable no-console */
import { execPromise, execObservable, l, error, linkifyIssues, linkifyCommit, linkifyCompare } from "./util";
import tasks from "./tasks";
import additionalQuestions from "./additional-questions";
import { isValidVersion } from "./version";
import History from "./history";

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

function getRepositoryUrl( { repository } ) {
  let url = repository && repository.url;
  if ( !url ) {
    return;
  }
  url = url.replace( /^\/+$/, "" ).replace( /\/tree[^]*$/, "" );
  return githubUrlFromGit( url, { extraBaseUrls: [ "gitlab.com" ] } );
}

export { execPromise, execObservable, tasks };

export async function publish( opts ) {

  defaultTasks( opts );

  opts.folder = path.resolve( opts.cwd, opts.folder );
  opts.relativeFolder = slash( path.relative( opts.cwd, opts.folder ) );

  const pkgJob = readPkg( { cwd: opts.folder } );
  const rootPkgJob = opts.folder === opts.cwd ? undefined : readPkg( { cwd: opts.cwd } );

  opts.pkg = await pkgJob;
  opts.rootPkg = await rootPkgJob;

  opts.pkgPath = path.resolve( opts.folder, "package.json" );
  opts.pkgNodeModules = path.resolve( opts.folder, "node_modules" );
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
    const repositoryUrl = getRepositoryUrl( opts.pkg );
    const tagPattern = opts.git.tagPrefix.replace( versionRe, "*" ).replace( nameRe, opts.pkg.name ).replace( /\*?$/g, "*" );
    let latestHash;
    try {
      latestHash = await execa.stdout( "git", [ "rev-list", `--tags=${tagPattern}`, "--max-count=1" ] );
    } catch ( e ) {
      // Ignore
    }
    if ( latestHash ) {
      const MAX = 10;
      const result = await execa.stdout( "git", [ "log", `--max-count=${MAX}`, "--format=%s %h", `${latestHash}..HEAD`, "--", opts.relativeFolder ] );

      if ( result ) {
        const history = result.split( "\n" );
        const historyText = history
          .map( commit => {
            const splitIndex = commit.lastIndexOf( " " );
            const commitMessage = linkifyIssues( repositoryUrl, commit.substring( 0, splitIndex ) );
            const commitId = linkifyCommit( repositoryUrl, commit.substring( splitIndex + 1 ) );
            return `- ${commitMessage}  ${commitId}`;
          } )
          .join( "\n" );

        info( `Commits since latest release:\n${historyText}\n` );
        info( `Showing only ${history.length} commits.\nFor maybe more: ${linkifyCompare( repositoryUrl, latestHash, opts.git.branch )}` );
      } else {
        const answers = await inquirer.prompt( [ {
          type: "confirm",
          name: "confirm",
          message: `No commits found since ${latestHash}, continue?`,
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

  const tasks = l();
  const toRun = opts.preview ? [
    opts.checkSensitiveData,
    opts.checkDeps
  ] : [
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
  ];

  for ( const t of toRun ) {
    if ( t ) {
      tasks.add( t( opts ) );
    }
  }

  const history = new History();

  try {
    await tasks.run( history );
  } catch ( err ) {
    console.error( "An error occurred. You might need to undo some operations:" );
    history.show();
    throw err;
  }

  if ( opts.preview ) {
    return;
  }

  const newPkg = await readPkg( {
    cwd: opts.folder,
    normalize: false
  } );

  console.log( `\n ${newPkg.name} ${newPkg.version} published 🎉` );
}

export default async function( opts ) {
  try {
    await publish( opts );
  } catch ( err ) {
    if ( err.__generated ) {
      console.error( `\n${logSymbols.error} ${err.message}` );
    } else {
      console.error( `\n${logSymbols.error} ${err.stack}` );
    }
    process.exitCode = 1;
  }
}
