// @flow
import Path from "./path";
import { t, toType } from "./types";

export function clone( path: Path, _type: any, cloned: any, src: any, key: any ) {

  path.push( key );

  const type = toType( _type, path );
  const { map } = type.extra;
  const srcValue = map ? map( src[ key ] ) : src[ key ];

  if ( srcValue === undefined ) {
    return;
  }

  const newValue = type.clone( path, srcValue );

  path.pop();

  if ( newValue !== undefined ) {
    cloned[ key ] = newValue;
  }
}

export function merge( path: Path, _type: any, object: any, src: any, key: any ) {

  path.push( key );

  const type = toType( _type, path );
  const { map, merge } = type.extra;
  const objValue = object[ key ];
  const srcValue = map ? map( src[ key ] ) : src[ key ];

  if ( srcValue === undefined ) {
    return;
  }

  if ( objValue !== undefined && merge === "override" ) {
    return;
  }

  let newValue;

  if ( objValue === undefined ) {
    newValue = type.clone( path, srcValue );
  } else {
    newValue = type.merge( path, objValue, srcValue );
  }

  path.pop();

  if ( newValue !== undefined ) {
    object[ key ] = newValue;
  }
}

function extractDefaultsHelper( path: Path, _type: any, defaults: any, key: any, dest: Object ) {
  const type = toType( _type, path );
  const { default: d, required, optional } = type || {};
  if ( required && optional ) {
    throw new Error( `[Schema] Don't use "required" and "optional" in ${path.chainToString()}` );
  }
  if ( d === undefined ) {
    if ( required || optional ) {
      return;
    }
  } else {
    if ( required ) {
      throw new Error( `[Schema] Don't use "required" with "default" in ${path.chainToString()}` );
    }
    return d;
  }
  const customDefault = type.defaults( path, dest );
  if ( customDefault !== undefined ) {
    return customDefault;
  }
  if ( !optional ) {
    throw new Error( `[Schema] Provide a default value or mark as "optional" in ${path.chainToString()}` );
  }
}

export function extractDefaults( path: Path, _type: any, defaults: any, key: any, dest: Object ) {

  path.push( key );

  const d = extractDefaultsHelper( path, _type, defaults, key, dest );

  if ( d !== undefined ) {
    defaults[ key ] = d;
  }

  path.pop();
}

export function applyDefaults( schema: Object, args: Object[], where: string[] = [] ) {
  const path = new Path();
  const type = t.object( { properties: schema } );
  if ( args.length > 0 ) {
    path.where = where[ 0 ];
    const dest = type.clone( path, args[ 0 ] );
    for ( let i = 1; i < args.length; i++ ) {
      path.where = where[ i ];
      type.merge( path, dest, args[ i ] );
    }
    path.where = null;
    type.merge( path, dest, type.defaults( path, dest ) );
    type.validate( path, dest, dest );
    return dest;
  }
  return type.defaults( path, {} );
}
