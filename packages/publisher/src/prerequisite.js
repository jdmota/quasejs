import { l, error } from "./util";

const prerequisiteTasks = require( "np/lib/prerequisite" );
const execa = require( "execa" );

export default function( opts ) {
  const newGitTagCheck = {
    title: "Check git tag existence",
    task: () => {
      return execa( "git", [ "fetch" ] )
        .then( () => execa.stdout( "git", [ "rev-parse", "--quiet", "--verify", `refs/tags/${opts.gitTag}` ] ) )
        .then(
          output => {
            if ( output ) {
              throw error( `Git tag \`${opts.gitTag}\` already exists.` );
            }
          },
          err => {
            // Command fails with code 1 and no output if the tag does not exist, even though `--quiet` is provided
            // https://github.com/sindresorhus/np/pull/73#discussion_r72385685
            if ( err.stdout !== "" || err.stderr !== "" ) {
              throw err;
            }
          }
        );
    }
  };

  const oldTasks = prerequisiteTasks( opts.version, opts.pkg, {
    publish: opts.publish,
    tag: opts.tag,
    yarn: opts.yarn
  } ).tasks;

  const newTasks = oldTasks.slice( 0, -1 );
  newTasks.push( newGitTagCheck );

  return l( newTasks, opts );
}
