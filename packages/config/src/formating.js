// @flow
import { type GeneralType, types } from "./types";

const concordance = require( "concordance" );
const chalk = require( "chalk" );

const reIndent = /^(?!\s*$)/mg;

export function indent( str: string, str2: string = "  " ) {
  return str.replace( reIndent, str2 );
}

export function addPrefix( path: string[], key: string ) {
  return path.length ? `${pathToStr( path )}.${key}` : key;
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
        if ( x instanceof types.Tuple ) {
          return formatTypes( x.items, ", " );
        }
        if ( x instanceof types.Array ) {
          return "array";
        }
        if ( x instanceof types.Object ) {
          return "object";
        }
      } else if ( typeof x.type === "string" ) {
        return x.type;
      }
    }
    return "";
  } ).join( separator );
}

export function formatOption( option: string ): string {
  return chalk.bold( concordance.format( option ) );
}

export function pathToStr( path: string[] ): string {
  return path.join( "." );
}

export function formatPathOption( path: string[] ): string {
  return chalk.bold( concordance.format( pathToStr( path ) ) );
}

export function format( value: any ) {
  return concordance.format( value );
}
