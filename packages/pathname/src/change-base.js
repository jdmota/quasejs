import { normalizeArr } from "./normalize";
import { relativeHelper } from "./relative";
import { split, join, assertPath } from "./vars";

export default function( fromPath, from2Path, toPath ) {
  const outputParts = relativeHelper( fromPath, toPath );

  assertPath( from2Path );
  const from2Parts = normalizeArr( split( from2Path ) );

  for ( let i = 0; i < outputParts.length; i++ ) {

    const p = outputParts[ i ];

    if ( !p || p === "." ) {
      continue;
    }

    if ( p === ".." ) {
      from2Parts.pop();
    } else {
      from2Parts.push( p );
    }

  }

  return join( from2Parts );
}
