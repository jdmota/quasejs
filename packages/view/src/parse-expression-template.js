// Adapted from https://github.com/Polymer/polymer/blob/master/lib/mixins/property-effects.html
const bindingRegex = ( function() {
  const IDENT = "(?:[a-zA-Z_$][\\w.:$\\-*]*)";
  const NUMBER = "(?:[-+]?[0-9]*\\.?[0-9]+(?:[eE][-+]?[0-9]+)?)";
  const SQUOTE_STRING = "(?:'(?:[^'\\\\]|\\\\.)*')";
  const DQUOTE_STRING = "(?:\"(?:[^\"\\\\]|\\\\.)*\")";
  const STRING = "(?:" + SQUOTE_STRING + "|" + DQUOTE_STRING + ")";
  const ARGUMENT = "(?:" + IDENT + "|" + NUMBER + "|" + STRING + "\\s*)";
  const ARGUMENTS = "(?:" + ARGUMENT + "(?:,\\s*" + ARGUMENT + ")*)";
  const ARGUMENT_LIST = "(?:\\(\\s*(?:" + ARGUMENTS + "?)\\)\\s*)";
  const BINDING = "((?:!\\s*)?" + IDENT + "\\s*" + ARGUMENT_LIST + "?)"; // Group 1
  const OPEN_BRACKET = "(?:\\[\\[|{{)\\s*";
  const CLOSE_BRACKET = "(?:]]|}})";
  return new RegExp( OPEN_BRACKET + BINDING + CLOSE_BRACKET, "g" );
} )();

// "literal1{{prop}}literal2{{!compute(foo,bar)}}final"
// [ "literal1", "prop", "literal2", "!compute(foo,bar)", "final" ]
export default function parseExpressionTemplate( text ) {

  let parts = [], lastIndex = 0, m;

  while ( m = bindingRegex.exec( text ) ) {
    parts.push( m.index > lastIndex ? text.slice( lastIndex, m.index ) : "" );
    parts.push( m[ 1 ].trim() );
    lastIndex = bindingRegex.lastIndex;
  }

  parts.push( text.substring( lastIndex ) );

  return parts;
}

/*

const babylon = req( "babylon" );

function parseJs( text, location ) {
  try {
    return babylon.parseExpression( text, { strictMode: true } );
  } catch ( e ) {
    error( "Invalid expression", location );
  }
}

*/
