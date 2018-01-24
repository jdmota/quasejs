import { t, types } from "./types";

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

export function extractDefaults( type ) {
  if ( !type ) {
    return;
  }
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
      const { type, default: d, required } = schema[ i ];
      defaults[ i ] = d === undefined && !required ? extractDefaults( type ) : d;
    }
    return defaults;
  }
  if ( type instanceof types.Object ) {
    const schema = type.properties;
    const defaults = {};
    for ( const k in schema ) {
      const { type, default: d, required } = schema[ k ];
      defaults[ k ] = d === undefined && !required ? extractDefaults( type ) : d;
    }
    return defaults;
  }
}

export function applyDefaults( schema, ...args ) {
  const dest = {};
  const type = t.object( schema );
  for ( let i = 0; i < args.length; i++ ) {
    applyDefaultsObject( type, dest, args[ i ] );
  }
  applyDefaultsObject( type, dest, extractDefaults( type ) );
  return dest;
}
