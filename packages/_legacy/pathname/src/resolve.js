import { normalizePre } from "./normalize";
import { isAbs } from "./is-absolute";
import { assertPath } from "./vars";

export default function() {

  let resolved = "", i = arguments.length, abs = false;

  // Start from the end
  while ( i-- && !abs ) {

    const path = arguments[ i ];

    assertPath( path );

    if ( path ) {

      // Keep resolving until we find an absolute path
      resolved = resolved ? path + "/" + resolved : path;

      abs = isAbs( resolved );

    }

  }

  return normalizePre( resolved );

}
