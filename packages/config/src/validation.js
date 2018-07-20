// @flow
import type Path from "./path";
import getType from "./get-type";
import { indent, formatOption, format } from "./formating";
import { printWarning } from "./print";
import { type GeneralType, types } from "./types";

const turbocolor = require( "turbocolor" );
const leven = require( "leven" );

export class ValidationError extends Error {
  +__validation: boolean;
  constructor( message: string | string[] ) {
    super( Array.isArray( message ) ? message.join( "\n" ) : message );
    this.name = "ValidationError";
    this.__validation = true;
  }
}

export function getSuggestion( unrecognized: string, allowedOptions: Array<string> ): ?string {
  return allowedOptions.find( option => {
    const steps: number = leven( option, unrecognized );
    return steps < 3;
  } );
}

export function createDidYouMeanMessage( unrecognized: string, allowedOptions: Array<string> ) {
  const suggestion = getSuggestion( unrecognized, allowedOptions );
  return suggestion ? `Did you mean ${formatOption( suggestion )}?` : "";
}

export function printDeprecated( path: Path, message: ?string ) {
  message = message || `Option ${path.format()} is deprecated.`;
  printWarning( `${turbocolor.bold( "Deprecation Warning" )}: ${message}` );
}

export function checkUnrecognized( keys: Array<string>, allowedOptions: Array<string>, what: ?string ) {

  const unrecognizedOptions = keys.filter( arg => !allowedOptions.includes( arg ) );

  if ( unrecognizedOptions.length === 0 ) {
    return;
  }

  what = what || "option";
  let message;

  if ( unrecognizedOptions.length === 1 ) {
    const unrecognized = unrecognizedOptions[ 0 ];
    const didYouMeanMessage = createDidYouMeanMessage( unrecognized, allowedOptions );
    message = `Unrecognized ${what} ${formatOption( unrecognized )}. ${didYouMeanMessage}`.trimRight();
  } else {
    message = `Following ${what}s were not recognized:\n  ${unrecognizedOptions.map( formatOption ).join( ", " )}`;
  }

  throw new ValidationError( message );
}

export function makeExample( path: Path, d: mixed, e: mixed ) {
  const chain = path.arr;
  const lines = [];
  const example = e === undefined ? d : e;
  if ( example !== undefined ) {
    lines.push( `Example:` );
    lines.push( `{` );
    for ( let i = 0; i < chain.length; i++ ) {
      if ( i === chain.length - 1 ) {
        lines.push(
          indent( `${formatOption( chain[ i ] )}: ${turbocolor.bold( format( example ) )}`, "  ".repeat( i + 1 ) )
        );
      } else {
        lines.push(
          `${"  ".repeat( i + 1 )}${formatOption( chain[ i ] )}: {`
        );
      }
    }
    for ( let i = chain.length - 2; i >= 0; i-- ) {
      lines.push( `${"  ".repeat( i + 1 )}}` );
    }
    lines.push( `}` );
  }
  return lines.join( "\n" );
}

export function checkType( path: Path, actual: string, expected: string, d: mixed, e: mixed ) {

  if ( actual === expected ) {
    return;
  }

  throw new ValidationError( [
    `Option ${path.format()} must be of type:`,
    `${indent( turbocolor.bold.green( expected ) )}`,
    `but instead received:`,
    `${indent( turbocolor.bold.red( actual ) )}`,
    makeExample( path, d, e )
  ] );
}

export function validateType( type: GeneralType, path: Path, value: mixed, dest: Object ) {
  if ( typeof type === "string" ) {
    checkType( path, getType( value ), type, undefined, undefined );
    return;
  }
  if ( type != null && typeof type === "object" ) {
    if ( type instanceof types.Type ) {
      type.validate( path, value, dest );
      return;
    }
    if ( type.type === "any" ) {
      return;
    }
    if ( type.type === "object" ) {
      new types.Object( type ).validate( path, value, dest );
      return;
    }
    if ( type.type === "array" ) {
      new types.Array( type ).validate( path, value, dest );
      return;
    }
    if ( typeof type.type === "string" ) {
      new types.Primitive( type ).validate( path, value, dest );
      return;
    }
  }
  throw new Error( `[Schema] Invalid type. See ${path.chainToString()}` );
}
