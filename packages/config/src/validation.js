// @flow
import { indent, formatOption, formatPathOption, format, pathToStr } from "./formating";
import { printWarning } from "./print";
import { type SchemaProp, types } from "./types";
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

export function makeExample( chain: string[], { default: d, example: e }: SchemaProp ) {
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

export function checkType( path: string[], actualType: string, expectedType: string, info: SchemaProp ) {

  if ( actualType === expectedType ) {
    return;
  }

  throw new ValidationError( [
    `Option ${formatPathOption( path )} must be of type:`,
    `${indent( chalk.bold.green( expectedType ) )}`,
    `but instead received:`,
    `${indent( chalk.bold.red( actualType ) )}`,
    makeExample( path, info )
  ] );
}

export function checkChoices( path: string[], value: mixed, choices: Array<mixed> ) {

  if ( choices.some( v => v === value ) ) {
    return;
  }

  throw new ValidationError( [
    `Option ${formatPathOption( path )} should be one of:`,
    `${indent( chalk.bold.green( choices.map( format ).join( " | " ) ) )}`,
    `but instead received:`,
    `${indent( chalk.bold.red( format( value ) ) )}`
  ] );
}

export function checkKeys( path: string[], object: any, schema: any ) {

  for ( const key in schema ) {
    path.push( key );

    const { type, choices, required, optional, deprecated } = schema[ key ];
    const value = object[ key ];
    if ( value === undefined ) {
      if ( required ) {
        throw new ValidationError( `Option ${formatPathOption( path )} is required.` );
      }
      if ( optional ) {
        continue;
      }
    } else {
      if ( deprecated ) {
        printDeprecated( path );
      }
    }
    if ( choices ) {
      checkChoices( path, value, choices );
    }
    if ( type ) {
      validateType( path, value, schema[ key ] );
    }

    path.pop();
  }

}

export function validateType( path: string[], value: any, info: SchemaProp ) {

  const { type } = info;

  if ( type instanceof types.Type ) {
    type.validate( path, value, info );
    return;
  }

  if ( typeof type === "string" ) {
    checkType( path, getType( value ), type, info );
    return;
  }

  throw new Error( `[Schema] Invalid type. See ${pathToStr( path )}` );
}
