const turbocolor = require( "turbocolor" );
const eol = turbocolor.reset( "\n" );

export function indentString( str, indent ) {
  indent = indent || 2;
  return ( str + "" ).replace( /^(?!\s*$)/mg, typeof indent === "number" ? " ".repeat( indent ) : indent );
}

export function log( str, indent ) {
  process.stdout.write( indentString( str, indent ) );
}

export function logEol() {
  process.stdout.write( eol );
}
