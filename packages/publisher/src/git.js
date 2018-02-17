import { l, error } from "./util";

const gitTasks = require( "np/lib/git" );
const execa = require( "execa" );

export default function( opts ) {
  const newBranchCheck = {
    title: "Check current branch",
    task: () => {
      return execa.stdout( "git", [ "symbolic-ref", "--short", "HEAD" ] ).then( branch => {
        if ( branch !== opts.gitBranch ) {
          throw error(
            `Not on \`${opts.gitBranch}\` branch. Use --git-branch to change from which branch you are publishing.`
          );
        }
      } );
    }
  };

  const oldTasks = gitTasks( {} ).tasks;

  const newTasks = oldTasks.slice( 1 );
  newTasks.unshift( newBranchCheck );

  return l( newTasks, opts );
}
