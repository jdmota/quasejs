import { t, types } from "./types";
import { addPrefix, validateType, formatOption } from "./validation";

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
      object[ key ],
      src[ key ],
      key,
      object
    );
  }
}

function applyDefaultsArrayMerge( type, object, src ) {
  for ( let i = 0; i < src.length; i++ ) {
    applyDefaultsHelper(
      type && type.items ? type.items[ i ] : null,
      object[ i ],
      src[ i ],
      i,
      object
    );
  }
}

function applyDefaultsHelper( info, objValue, srcValue, key, object ) {

  if ( objValue === undefined ) {
    if ( srcValue !== undefined ) {
      object[ key ] = clone( srcValue );
    }
    return;
  }

  const { type, merge } = info || {};

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

export function extractDefaults( fullKey, { type, default: d, required, optional } ) {
  if ( required && optional ) {
    throw new Error( `[Schema] Don't use "required" and "optional" in ${formatOption( fullKey )}` );
  }
  if ( d === undefined ) {
    if ( required ) {
      return;
    }
  } else {
    if ( required ) {
      throw new Error( `[Schema] Don't use "required" with "default" in ${formatOption( fullKey )}` );
    }
    if ( type ) {
      try {
        validateType( fullKey, d, type );
      } catch ( e ) {
        throw new Error( `[Schema] "default" does not match the type in ${formatOption( fullKey )}` );
      }
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
    if ( type instanceof types.Tuple ) {
      const schema = type.items;
      const defaults = [];
      for ( let i = 0; i < schema.length; i++ ) {
        defaults[ i ] = extractDefaults( addPrefix( fullKey, i + "" ), schema[ i ] );
      }
      return defaults;
    }
    if ( type instanceof types.Object ) {
      const schema = type.properties;
      const defaults = {};
      for ( const k in schema ) {
        defaults[ k ] = extractDefaults( addPrefix( fullKey, k ), schema[ k ] );
      }
      return defaults;
    }
  }
  if ( !optional ) {
    throw new Error( `[Schema] Provide a default value or mark as "optional" in ${formatOption( fullKey )}` );
  }
}

export function applyDefaults( schema, ...args ) {
  const dest = {};
  const type = t.object( schema );
  const defaults = extractDefaults( "", { type } );
  for ( let i = 0; i < args.length; i++ ) {
    applyDefaultsObject( type, dest, args[ i ] );
  }
  applyDefaultsObject( type, dest, defaults );
  return dest;
}
