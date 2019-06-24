import { normalizePre } from "./normalize";
import { assertPath } from "./vars";

export default function() {

  const paths = [];

  for ( let i = 0; i < arguments.length; i++ ) {
    const arg = arguments[ i ];
    assertPath( arg );
    if ( arg ) {
      paths.push( arg );
    }
  }

  return normalizePre( paths.join( "/" ) );
}
