// @flow
/* eslint-disable no-console */
import { indent, formatTypes, formatOption, formatPathOption, format, pathToStr } from "./formating";
import { printWarning } from "./print";
import { type MaybeType, types } from "./types";
import getType from "./get-type";

const chalk = require( "chalk" );
const leven = require( "leven" );

export class ValidationError extends Error {
  +__validation: boolean;
  constructor( message: string | string[] ) {
    super( Array.isArray( message ) ? message.join( "\n" ) : message );
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

export function makeExample( chain: string[], example: mixed ) {
  const lines = [];
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

export function checkType( path: string[], actualType: string, expectedType: string, example: mixed ) {

  if ( actualType === expectedType ) {
    return;
  }

  throw new ValidationError( [
    `Option ${formatPathOption( path )} must be of type:`,
    `${indent( chalk.bold.green( expectedType ) )}`,
    `but instead received:`,
    `${indent( chalk.bold.red( actualType ) )}`,
    makeExample( path, example )
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

export function addPrefix( path: string[], key: string ) {
  return path.length ? `${pathToStr( path )}.${key}` : key;
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
      validateType( path, value, type, getExample( schema[ key ] ) );
    }

    path.pop();
  }

}

export function getExample( { default: d, example }: { default: any, example: any } ) {
  return example === undefined ? d : example;
}

export function validateType( path: string[], value: any, type: MaybeType, example: mixed ) {

  if ( type instanceof types.Union ) {
    for ( const t of type.types ) {
      try {
        validateType( path, value, t );
        return;
      } catch ( e ) {
        // Ignore
      }
    }
    throw new ValidationError( [
      `Option ${formatPathOption( path )} should be one of these types:`,
      `${indent( chalk.bold.green( formatTypes( type.types ) ) )}`,
      `but instead received:`,
      `${indent( chalk.bold.red( format( value ) ) )}`,
      makeExample( path, example )
    ] );
  }

  const actualType = getType( value );

  if ( type instanceof types.Object ) {

    checkType( path, actualType, "object", example );

    checkUnrecognized(
      Object.keys( value ).map( o => addPrefix( path, o ) ),
      type.keys.map( o => addPrefix( path, o ) )
    );

    checkKeys( path, value, type.properties );

    return;
  }

  if ( type instanceof types.Array ) {

    checkType( path, actualType, "array", example );

    if ( type.itemType ) {
      for ( let i = 0; i < value.length; i++ ) {
        validateType( path, value[ i ], type.itemType.type, getExample( type.itemType ) );
      }
    }

    return;
  }

  if ( type instanceof types.Tuple ) {

    if ( !Array.isArray( value ) || value.length !== type.items.length ) {
      throw new ValidationError( [
        `Option ${formatPathOption( path )} must be an array of ${type.items.length} items.`,
        makeExample( path, example )
      ] );
    }

    checkKeys( path, value, type.items );

    return;
  }

  if ( type instanceof types.Value ) {

    if ( value === type.value ) {
      return;
    }

    throw new ValidationError( [
      `Option ${formatPathOption( path )} should be:`,
      `${indent( format( type.value ) )}`,
      `but instead received:`,
      `${indent( chalk.bold.red( format( value ) ) )}`
    ] );
  }

  if ( typeof type === "string" ) {
    checkType( path, actualType, type, example );
    return;
  }

  throw new Error( `[Schema] Invalid type. See ${pathToStr( path )}` );
}
