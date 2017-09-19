import { symbolToString } from "./symbols";

function baseToString( value ) {
  if ( typeof value === "string" ) {
    return value;
  }
  if ( typeof value === "symbol" ) {
    return symbolToString ? symbolToString.call( value ) : "";
  }
  const result = value + "";
  return ( result === "0" && ( 1 / value ) === -Infinity ) ? "-0" : result;
}

export default function( value ) {
  return value == null ? "" : baseToString( value );
}
