/* eslint-disable no-console */
import "./util/register-observable";
import hasYarn from "has-yarn";
import logSymbols from "log-symbols";
import readPkg from "read-pkg";
import slash from "slash";
import path from "path";
import { execPromise, execStdout, execObservable, l, error, info } from "./util/util";
import { Options, ProvidedOptions, Pkg, GitOptions } from "./types";
import * as git from "./util/git";
import * as tasks from "./tasks";
import additionalQuestions from "./questions";
import { isValidVersion, getNewVersion } from "./util/version";
import History from "./history";

const fs = require( "fs-extra" );

function getConfig( yarn: boolean, npmKey: string, yarnKey: string ): Promise<string> {
  if ( yarn ) {
    return execStdout( "yarn", [ "config", "get", yarnKey ] );
  }
  return execStdout( "npm", [ "config", "get", npmKey ] );
}

function getVersionGitMessage( yarn: boolean ) {
  return getConfig( yarn, "message", "version-git-message" );
}

function getVersionTagPrefix( yarn: boolean ) {
  return getConfig( yarn, "tag-version-prefix", "version-tag-prefix" );
}

function defaultTasks( providedTasks: any = {} ) {
  const tasksToRun: any = {};
  for ( const key in tasks ) {
    if ( key === "__esModule" ) continue;
    if ( providedTasks[ key ] === true || providedTasks[ key ] === "true" || providedTasks[ key ] === undefined ) {
      // @ts-ignore
      tasksToRun[ key ] = tasks[ key ];
    } else if ( providedTasks[ key ] === false || providedTasks[ key ] === "false" ) {
      // Ignore
    } else if ( typeof providedTasks[ key ] === "function" ) {
      tasksToRun[ key ] = providedTasks[ key ];
    } else {
      throw error( `Expected task '${key}' to be a function, instead saw ${providedTasks[ key ]}` );
    }
  }
  return tasksToRun;
}

export { execPromise, execObservable, tasks };

async function handleOptions( provided: ProvidedOptions, history: History ): Promise<Options> {

  const tasks = defaultTasks( provided.tasks );

  const cwd: string = path.resolve( provided.cwd );
  const folder: string = path.resolve( cwd, provided.folder );
  const relativeFolder: string = slash( path.relative( cwd, folder ) );

  const pkgJob: Promise<Pkg> = readPkg( { cwd: folder } );
  const rootPkgJob: Promise<Pkg> | undefined = folder === cwd ? undefined : readPkg( { cwd: cwd } );

  const pkg = await pkgJob;
  const rootPkg = await rootPkgJob;

  const pkgPath: string = path.resolve( folder, "package.json" );
  const pkgNodeModules: string = path.resolve( folder, "node_modules" );
  const pkgRelativePath: string = slash( path.relative( cwd, pkgPath ) );

  if ( !pkg ) {
    throw error( "No package.json found. Make sure you're in the correct project." );
  }

  if ( !pkg.name ) {
    throw error( `Missing 'name' on ${pkgRelativePath}` );
  }

  if ( !isValidVersion( pkg.version ) ) {
    throw error( `Missing valid 'version' on ${pkgRelativePath}. If this is the first version, just set it to 0.0.1, e.g.` );
  }

  console.log();
  info( `Current: ${pkg.name}@${pkg.version} [${pkgRelativePath}]` );

  // If version was already provided, validate it
  if ( provided.version ) {
    provided.version = getNewVersion( pkg.version, provided.version );
  }

  let yarn = provided.yarn;
  if ( yarn === undefined ) {
    yarn = hasYarn( folder ) as boolean;
  }

  let hasNpmLockfile: boolean | undefined;
  if ( !yarn ) {
    hasNpmLockfile =
      await fs.exists( path.resolve( folder, "package-lock.json" ) ) ||
      await fs.exists( path.resolve( folder, "npm-shrinkwrap.json" ) );
  }

  let git: GitOptions;

  const d = <T>( value: T | undefined, defaultt: T ) => ( value === undefined ? defaultt : value );

  if ( provided.git === true ) {
    git = {
      root: undefined,
      branch: "master",
      check: true,
      commitAndTag: true,
      push: true,
      message: undefined,
      tagPrefix: undefined,
      signCommit: true,
      signTag: true,
      commitHooks: true,
      pushHooks: true
    };
  } else if ( provided.git === false ) {
    git = {
      root: undefined,
      branch: "master",
      check: false,
      commitAndTag: false,
      push: false,
      message: undefined,
      tagPrefix: undefined,
      signCommit: false,
      signTag: false,
      commitHooks: false,
      pushHooks: false
    };
  } else {
    git = {
      root: "",
      branch: d( provided.git.branch, "master" ),
      check: d( provided.git.check, true ),
      commitAndTag: d( provided.git.commitAndTag, true ),
      push: d( provided.git.push, true ),
      message: provided.git.message,
      tagPrefix: provided.git.tagPrefix,
      signCommit: d( provided.git.signCommit, true ),
      signTag: d( provided.git.signTag, true ),
      commitHooks: d( provided.git.commitHooks, true ),
      pushHooks: d( provided.git.pushHooks, true ),
    };
  }

  if ( provided.git !== false ) {
    const gitMessageJob = git.commitAndTag ? git.message || getVersionGitMessage( yarn ) : undefined;
    const gitTagPrefixJob = git.commitAndTag === true ? git.tagPrefix || getVersionTagPrefix( yarn ) : undefined;
    const gitRootJob: Promise<string> = execStdout( "git", [ "rev-parse", "--show-toplevel" ] );

    git.message = await gitMessageJob;
    git.tagPrefix = await gitTagPrefixJob;
    git.root = await gitRootJob;
  }

  if ( git.commitAndTag && !git.message ) {
    throw error( `Empty git commit message.` );
  }

  if ( git.commitAndTag === true && !git.tagPrefix ) {
    throw error( `Empty git tag prefix. Set git.commitAndTag to 'only-commit' if you do not want to tag the commit.` );
  }

  return {
    cwd,
    folder,
    relativeFolder,
    pkg,
    rootPkg,
    pkgPath,
    pkgNodeModules,
    pkgRelativePath,
    yarn,
    hasNpmLockfile,
    version: provided.version || "", // Filled in additionalQuestions
    tag: provided.tag, // Filled in additionalQuestions
    access: provided.access || "", // Filled in additionalQuestions
    contents: provided.contents,
    preview: provided.preview,
    publish: provided.publish,
    git,
    tasks,
    history
  };
}

export async function publish( provided: ProvidedOptions, historyReady: ( h: History ) => void ) {

  const history = new History();
  historyReady( history );

  const opts = await handleOptions( provided, history );
  const okToContinue = await additionalQuestions( opts );

  console.log();
  info( opts.pkg.name );
  info( opts.version );
  if ( opts.tag ) {
    info( `Tag: ${opts.tag}` );
  }
  info( `Pkg: ${opts.pkgRelativePath}` );
  if ( opts.git.message ) {
    info( `Git Branch: ${opts.git.branch}` );
    info( `Git Message: ${git.createMessage( opts as Options & { git: GitOptions & { message: string } } )}` );
    if ( opts.git.tagPrefix ) {
      info( `Git Tag: ${git.createTag( opts as Options & { git: GitOptions & { tagPrefix: string } } )}` );
    }
  }
  info( opts.yarn ? "Using Yarn" : "Using npm" );
  console.log();

  if ( !okToContinue ) {
    console.log( "Aborted: not confirmed." );
    return;
  }

  const tasks = l();
  const toRun = opts.preview ? [
    opts.tasks.checkSensitiveData,
    opts.tasks.checkVersions,
    opts.tasks.checkDeps
  ] : [
    opts.tasks.checkSensitiveData,
    opts.tasks.checkVersions,
    opts.tasks.checkDeps,
    opts.tasks.preCheck,
    opts.tasks.gitCheck,
    opts.tasks.cleanup,
    opts.tasks.build,
    opts.tasks.test,
    opts.tasks.rootBeforeVersion,
    opts.tasks.bumpVersion,
    opts.tasks.changelog,
    opts.tasks.commitAndTag,
    opts.tasks.rootAfterVersion,
    opts.tasks.rootBeforePublish,
    opts.tasks.publish,
    opts.tasks.rootAfterPublish,
    opts.tasks.gitPush,
  ];

  for ( const t of toRun ) {
    if ( t ) {
      tasks.add( t( opts ) );
    }
  }

  try {
    await tasks.run();
  } catch ( err ) {
    history.show();
    throw err;
  }

  if ( opts.preview ) {
    console.log( "Preview" );
    console.log( opts );
    return;
  }

  const newPkg = await readPkg( {
    cwd: opts.folder,
    normalize: false
  } );

  console.log( `\n ${newPkg.name} ${newPkg.version} published 🎉` );
}

export default async function( opts: ProvidedOptions, historyReady: ( h: History ) => void ) {
  try {
    await publish( opts, historyReady );
  } catch ( err ) {
    if ( err.__generated ) {
      console.error( `\n${logSymbols.error} ${err.message}\n` );
    } else {
      console.error( `\n${logSymbols.error} ${err.stack}\n` );
    }
    process.exitCode = 1;
  }
}
