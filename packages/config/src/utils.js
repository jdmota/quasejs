// @flow
const toString = ( {} ).toString;

export function isObject( x: any ) {
  return x != null && typeof x === "object";
}

export function isPlainObject( value: any ) {
  if ( !isObject( value ) || toString.call( value ) !== "[object Object]" ) {
    return false;
  }
  if ( Object.getPrototypeOf( value ) === null ) {
    return true;
  }
  let proto = value;
  while ( Object.getPrototypeOf( proto ) !== null ) {
    proto = Object.getPrototypeOf( proto );
  }
  return Object.getPrototypeOf( value ) === proto;
}

export function clone( x: any ) {
  if ( Array.isArray( x ) ) {
    const value = [];
    for ( let i = 0; i < x.length; i++ ) {
      value[ i ] = clone( x[ i ] );
    }
    return value;
  }
  if ( isPlainObject( x ) ) {
    const value = {};
    for ( const key in x ) {
      value[ key ] = clone( x[ key ] );
    }
    return value;
  }
  return x;
}
