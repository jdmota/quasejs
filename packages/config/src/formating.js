// @flow
import type Path from "./path";
import { type GeneralType, types } from "./types";

const turbocolor = require( "turbocolor" );

const reIndent = /^(?!\s*$)/mg;

export function indent( str: string, str2: string = "  " ) {
  return str.replace( reIndent, str2 );
}

export function addPrefix( path: Path, key: string ) {
  return path.size() ? `${path.chainToString()}.${key}` : key;
}

export function formatTypes( list: $ReadOnlyArray<?GeneralType>, separator: string = " | " ): string {
  return list.filter( Boolean ).map( x => {
    if ( typeof x === "string" ) {
      return x;
    }
    if ( x != null ) {
      if ( x instanceof types.Type ) {
        if ( x instanceof types.Union ) {
          return formatTypes( x.types );
        }
        if ( x instanceof types.Value ) {
          return format( x.value );
        }
        if ( x instanceof types.Choices ) {
          return x.values.map( format ).join( " | " );
        }
        if ( x instanceof types.Tuple ) {
          return formatTypes( x.items, ", " );
        }
        if ( x instanceof types.Array ) {
          return "array";
        }
        if ( x instanceof types.Object ) {
          return "object";
        }
        if ( x instanceof types.Any ) {
          return "any";
        }
        if ( x instanceof types.Primitive ) {
          return x.type;
        }
      } else if ( typeof x.type === "string" ) {
        return x.type;
      }
    }
    return "";
  } ).join( separator );
}

const util = require( "util" );

export function formatOption( option: string ): string {
  return turbocolor.bold( util.inspect( option ) );
}

export function format( value: any ) {
  return util.inspect( value );
}
