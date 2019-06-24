const reRegExpChar = /[\\.+*?=^!:${}()[\]|/]/g;

const reHasRegExpChar = new RegExp( reRegExpChar.source );

export default function( str ) {
  const string = str + "";
  return ( string && reHasRegExpChar.test( string ) ) ?
    string.replace( reRegExpChar, "\\$&" ) :
    string;
}
