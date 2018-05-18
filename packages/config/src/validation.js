// @flow
import { indent, formatOption, formatPathOption, format, pathToStr } from "./formating";
import { printWarning } from "./print";
import { type GeneralType, types } from "./types";
import getType from "./get-type";

const chalk = require( "chalk" );
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

export function printDeprecated( path: string[], message: ?string ) {
  message = message || `Option ${formatPathOption( path )} is deprecated.`;
  printWarning( `${chalk.bold( "Deprecation Warning" )}: ${message}` );
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

export function makeExample( chain: string[], d: mixed, e: mixed ) {
  const lines = [];
  const example = e === undefined ? d : e;
  if ( example !== undefined ) {
    lines.push( `Example:` );
    lines.push( `{` );
    for ( let i = 0; i < chain.length; i++ ) {
      if ( i === chain.length - 1 ) {
        lines.push(
          indent( `${formatOption( chain[ i ] )}: ${chalk.bold( format( example ) )}`, "  ".repeat( i + 1 ) )
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

export function checkType(
  path: string[], actualType: string, expectedType: string, d: mixed, e: mixed
) {

  if ( actualType === expectedType ) {
    return;
  }

  throw new ValidationError( [
    `Option ${formatPathOption( path )} must be of type:`,
    `${indent( chalk.bold.green( expectedType ) )}`,
    `but instead received:`,
    `${indent( chalk.bold.red( actualType ) )}`,
    makeExample( path, d, e )
  ] );
}

export function checkKeys( properties: any, path: string[], object: any, dest: Object ) {
  for ( const key in properties ) {
    path.push( key );
    const type = properties[ key ];
    if ( type ) {
      validateType( type, path, object[ key ], dest );
    }
    path.pop();
  }
}

export function validateType( type: GeneralType, path: string[], value: mixed, dest: Object ) {
  if ( typeof type === "string" ) {
    checkType( path, getType( value ), type, undefined, undefined );
    return;
  }
  if ( type != null && typeof type === "object" ) {
    if ( type instanceof types.Type ) {
      type.validate( path, value, dest );
      return;
    }
    if ( typeof type.type === "string" ) {
      new types.Primitive( type ).validate( path, value, dest );
      return;
    }
  }
  throw new Error( `[Schema] Invalid type. See ${pathToStr( path )}` );
}
