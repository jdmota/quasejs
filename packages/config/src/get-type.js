// @flow

export default function( value: any ): string {
  if ( value === undefined ) {
    return "undefined";
  }
  if ( value === null ) {
    return "null";
  }
  if ( Array.isArray( value ) ) {
    return "array";
  }
  if ( typeof value === "boolean" ) {
    return "boolean";
  }
  if ( typeof value === "function" ) {
    return "function";
  }
  if ( typeof value === "number" ) {
    return "number";
  }
  if ( typeof value === "string" ) {
    return "string";
  }
  if ( typeof value === "object" ) {
    if ( value.constructor === RegExp ) {
      return "regexp";
    }
    if ( value.constructor === Map ) {
      return "map";
    }
    if ( value.constructor === Set ) {
      return "set";
    }
    if ( value.constructor === Date ) {
      return "date";
    }
    return "object";
  }
  // $FlowFixMe
  if ( typeof value === "symbol" ) {
    return "symbol";
  }
  throw new Error( `value of unknown type: ${value}` );
}
