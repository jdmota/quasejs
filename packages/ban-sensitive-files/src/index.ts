import { Options } from "./types";
import isBanned from "./is-banned";
import collectFiles from "./collect-files";
import checkSensitiveFiles from "./check-sensitive-files";

function msg( number: number, string: string ): string {
  return string.replace( /%d/g, number + "" ).replace( /%s/g, number === 1 ? "" : "" );
}

export async function bin( options: Options ) {
  /* eslint-disable no-console */
  console.log( "Searching for sensitive data..." );

  const { banned, sensitive } = await run( options );

  if ( banned.length > 0 ) {
    console.error( msg( banned.length, `\n%d banned file%s found:` ) );
    for ( const b of banned ) {
      console.error( `  ${b.filename}` );
      if ( options.verbose ) {
        for ( const rule of b.rules ) {
          if ( rule.caption ) {
            console.error( `    ${rule.caption}` );
          }
          if ( rule.description ) {
            console.error( `      ${rule.description}` );
          }
        }
      }
    }
  }

  if ( sensitive.length > 0 ) {
    console.error( msg( sensitive.length, `\n%d file%s with sensitive data found:` ) );
    for ( const s of sensitive ) {
      console.error( `  ${s.filename}` );
      if ( options.verbose ) {
        for ( const error of s.errors ) {
          console.error( `    ${error}` );
        }
      }
    }
  }

  const error = banned.length > 0 || sensitive.length > 0;
  if ( error ) {
    console.error( msg( banned.length + sensitive.length, `\n%d sensitive file%s found.` ) );
    process.exitCode = 1;
  } else {
    console.log( "All ok!" );
  }
  return error;
}

async function run( options: Options, providedFilenames?: string[] ) {
  const filenames = providedFilenames || await collectFiles( options );
  const banned = isBanned( filenames );
  const sensitive = await checkSensitiveFiles( filenames );
  return {
    banned,
    sensitive
  };
}

export default run;
