// @flow
import { type MaybeType, types } from "./types";

const concordance = require( "concordance" );
const chalk = require( "chalk" );

const reIndent = /^(?!\s*$)/mg;

export function indent( str: string, str2: string = "  " ) {
  return str.replace( reIndent, str2 );
}

export function formatTypes( list: $ReadOnlyArray<MaybeType>, separator: string = " | " ): string {
  return list.filter( Boolean ).map( x => {
    if ( typeof x === "string" ) {
      return x;
    }
    if ( x instanceof types.Union ) {
      return formatTypes( x.types );
    }
    if ( x instanceof types.Value ) {
      return format( x.value );
    }
    if ( x instanceof types.Tuple ) {
      return formatTypes( x.items.map( i => i.type ), ", " );
    }
    if ( x instanceof types.Array ) {
      return "array";
    }
    if ( x instanceof types.Object ) {
      return "object";
    }
    return "";
  } ).join( separator );
}

export function formatOption( str: string ): string {
  return chalk.bold( concordance.format( str ) );
}

export function format( value: any ) {
  return concordance.format( value );
}