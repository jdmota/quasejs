import { t, types } from "./types";
import { formatPathOption } from "./formating";

const toString = ( {} ).toString;

function isObject( x ) {
  return x != null && typeof x === "object";
}

function isPlainObject( value ) {
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

function clone( x ) {
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

function applyDefaultsObject( type, object, src ) {
  for ( const key in src ) {
    applyDefaultsHelper(
      type && type.properties ? type.properties[ key ] : null,
      object,
      src,
      key
    );
  }
}

function applyDefaultsArrayMerge( type, object, src ) {
  for ( let i = 0; i < src.length; i++ ) {
    applyDefaultsHelper(
      type && type.items ? type.items[ i ] : null,
      object,
      src,
      i
    );
  }
}

function applyDefaultsHelper( info, object, src, key ) {

  const { type, map, merge } = info || {};

  const objValue = object[ key ];
  const srcValue = map ? map( src[ key ] ) : src[ key ];

  if ( objValue === undefined ) {
    if ( srcValue !== undefined ) {
      object[ key ] = clone( srcValue );
    }
    return;
  }

  if ( typeof merge === "function" ) {
    const newValue = merge( objValue, srcValue );
    if ( newValue !== undefined ) {
      object[ key ] = newValue;
      return;
    }
  }

  if ( merge === "override" ) {
    return;
  }

  if ( Array.isArray( objValue ) && Array.isArray( srcValue ) ) {
    if ( merge === "merge" || type instanceof types.Tuple ) {
      applyDefaultsArrayMerge( type, objValue, srcValue );
    } else if ( merge === "concat" ) {
      object[ key ] = srcValue.concat( objValue );
    } else if ( merge === "spreadMeansConcat" && objValue[ 0 ] === "..." ) {
      object[ key ] = srcValue.concat( objValue.slice( 1 ) );
    }
    return;
  }

  if ( isPlainObject( objValue ) && isPlainObject( srcValue ) ) {
    applyDefaultsObject( type, objValue, srcValue );
  }

}

const opt = formatPathOption;

export function extractDefaults( path, info, dest ) {
  const { type, default: d, required, optional } = info;
  if ( required && optional ) {
    throw new Error( `[Schema] Don't use "required" and "optional" in ${opt( path )}` );
  }
  if ( d === undefined ) {
    if ( required || optional ) {
      return;
    }
  } else {
    if ( required ) {
      throw new Error( `[Schema] Don't use "required" with "default" in ${opt( path )}` );
    }
    return d;
  }
  if ( type ) {
    if ( type === "boolean" ) {
      return false;
    }
    if ( type === "array" || type instanceof types.Array ) {
      return [];
    }
    if ( type === "object" ) {
      return {};
    }
    if ( type instanceof types.Type ) {
      const customDefault = type.defaults( path, dest );
      if ( customDefault !== undefined ) {
        return customDefault;
      }
    }
  }
  if ( !optional ) {
    throw new Error( `[Schema] Provide a default value or mark as "optional" in ${opt( path )}` );
  }
}

export function applyDefaults( schema, ...args ) {
  const dest = {};
  const type = t.object( schema );
  for ( let i = 0; i < args.length; i++ ) {
    applyDefaultsObject( type, dest, args[ i ] );
  }
  applyDefaultsObject( type, dest, extractDefaults( [], { type }, dest ) );
  return dest;
}
