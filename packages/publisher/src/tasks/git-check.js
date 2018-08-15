import { l, error } from "../util";

// Adapted from https://github.com/sindresorhus/np

const execa = require( "execa" );
const isWin = process.platform === "win32";

export default function( opts ) {
  const tasks = [
    {
      title: "Check current branch",
      task: () => {
        return execa.stdout( "git", [ "symbolic-ref", "--short", "HEAD" ] ).then( branch => {
          if ( branch !== opts.git.branch ) {
            throw error(
              `Not on \`${opts.git.branch}\` branch. Use --git.branch to change from which branch you are publishing.`
            );
          }
        } );
      }
    },
    {
      title: "Check local working tree",
      task: () => execa.stdout( "git", [ "status", "--porcelain" ] ).then( status => {
        if ( status !== "" ) {
          throw new Error( "Unclean working tree. Commit or stash changes first." );
        }
      } )
    },
    {
      title: "Check remote history",
      task: () => execa.stdout( "git", [ "rev-list", "--count", "--left-only", isWin ? "'@{u}...HEAD'" : "@{u}...HEAD" ] ).then( result => {
        if ( result !== "0" ) {
          throw new Error( "Remote history differs. Please pull changes." );
        }
      } )
    }
  ];

  return l( tasks );
}
