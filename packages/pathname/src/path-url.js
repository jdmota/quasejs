import req from "../../_helper/require";

const path = req( "path" );
const URL = typeof window !== "undefined" && window.URL; // eslint-disable-line no-undef
const LOCATION = typeof window !== "undefined" && window.location; // eslint-disable-line no-undef

export function makeAbsolute( file ) {
  return URL ? new URL( file, LOCATION ).href : path.resolve( file );
}

export function resolveAsUrl( from, to ) {
  return URL ? new URL( to, from ).href : path.resolve( path.dirname( from ), to );
}

export function normalize( file ) {
  if ( URL ) {
    return new URL( file, LOCATION ).pathname;
  }
  return path.relative( process.cwd(), file ).replace( /\\/g, "/" );
}
