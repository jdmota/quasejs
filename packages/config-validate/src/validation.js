// @flow
/* eslint-disable no-console */
import { printWarning } from "./print";
import { types } from "./types";
import getType from "./get-type";

const concordance = require( "concordance" );
const chalk = require( "chalk" );
const leven = require( "leven" );

export class ValidationError extends Error {
  +__validation: boolean;
  constructor( message: string ) {
    super( message );
    this.__validation = true;
  }
}

export function formatOption( str: string ): string {
  return chalk.bold( concordance.format( str ) );
}

export function format( value: any ) {
  return concordance.format( value );
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

export function printDeprecated( option: string, message: ?string ) {
  message = message || `Option ${formatOption( option )} is deprecated.`;
  printWarning( `${chalk.bold( "Deprecation Warning" )}: ${message}` );
}

export function checkUnrecognized( keys: Array<string>, allowedOptions: Array<string>, type: ?string ) {

  const unrecognizedOptions = keys.filter( arg => !allowedOptions.includes( arg ) );

  if ( unrecognizedOptions.length === 0 ) {
    return;
  }

  type = type || "option";
  let message;

  if ( unrecognizedOptions.length === 1 ) {
    const unrecognized = unrecognizedOptions[ 0 ];
    const didYouMeanMessage = createDidYouMeanMessage( unrecognized, allowedOptions );
    message = `Unrecognized ${type} ${formatOption( unrecognized )}. ${didYouMeanMessage}`.trimRight();
  } else {
    message = `Following ${type}s were not recognized:\n  ${unrecognizedOptions.map( formatOption ).join( ", " )}`;
  }

  throw new ValidationError( message );
}

function join( array ) {
  return array.filter( Boolean ).join( "\n" );
}

export function makeExample( option: string, example: mixed ) {
  const lines = [];
  if ( example !== undefined ) {
    lines.push( `Example:` );
    lines.push( `{` );
    const chain = option.split( "." );
    for ( let i = 0; i < chain.length; i++ ) {
      lines.push(
        `${"  ".repeat( i + 1 )}${formatOption( chain[ i ] )}: ${i === chain.length - 1 ? chalk.bold( format( example ) ) : "{"}`
      );
    }
    for ( let i = chain.length - 2; i >= 0; i-- ) {
      lines.push( `${"  ".repeat( i + 1 )}}` );
    }
    lines.push( `}` );
  }
  return join( lines );
}

export function checkType( option: string, actualType: string, expectedType: string, example: mixed ) {

  if ( actualType === expectedType ) {
    return;
  }

  const messageLines = [
    `Option ${formatOption( option )} must be of type:`,
    `  ${chalk.bold.green( expectedType )}`,
    `but instead received:`,
    `  ${chalk.bold.red( actualType )}`,
    makeExample( option, example )
  ];

  throw new ValidationError( join( messageLines ) );
}

export function checkChoices( option: string, value: mixed, choices: Array<mixed> ) {

  if ( choices.some( v => v === value ) ) {
    return;
  }

  const messageLines = [
    `Option ${formatOption( option )} should be one of:`,
    `  ${chalk.bold.green( choices.map( format ).join( " | " ) )}`,
    `but instead received:`,
    `  ${chalk.bold.red( format( value ) )}`
  ];

  throw new ValidationError( messageLines.join( "\n" ) );
}

export function checkKeys( optionPrefix: ?string, object: any, schema: any ) {

  const deprecatedKeys = [];

  for ( const key in schema ) {
    const fullKey = addPrefix( optionPrefix, key );
    const { type, choices, required, default: _default, deprecated, example } = schema[ key ];
    const value = object[ key ];
    if ( value === undefined ) {
      if ( required ) {
        throw new ValidationError( `Option ${formatOption( fullKey )} is required.` );
      }
    } else {
      if ( deprecated ) {
        deprecatedKeys.push( fullKey );
      }
    }
    if ( choices ) {
      checkChoices( fullKey, value, choices );
    }
    if ( type ) {
      validateType( fullKey, value, type, example === undefined ? _default : example );
    }
  }

  for ( const key of deprecatedKeys ) {
    printDeprecated( key );
  }

}

function addPrefix( prefix: ?string, key: string ) {
  return prefix ? `${prefix}.${key}` : key;
}

export function validateType( fullKey: string, value: any, type: ?string | types.Type, example: mixed ) {

  if ( type instanceof types.Union ) {
    let passed = false;
    for ( const t of type.types ) {
      try {
        validateType( fullKey, value, t );
        passed = true;
        break;
      } catch ( e ) {
        // Ignore
      }
    }
    if ( passed ) {
      return;
    }
    const lines = [
      `Option ${formatOption( fullKey )} does not match any of the expected types.`,
      makeExample( fullKey, example )
    ];
    throw new ValidationError( join( lines ) );
  }

  const actualType = getType( value );

  if ( type instanceof types.Object ) {

    checkType( fullKey, actualType, "object", example );

    checkUnrecognized(
      Object.keys( value ).map( o => addPrefix( fullKey, o ) ),
      Object.keys( type.properties ).map( o => addPrefix( fullKey, o ) )
    );

    checkKeys( fullKey, value, type.properties );

    return;
  }

  if ( type instanceof types.Array ) {

    checkType( fullKey, actualType, "array", example );

    if ( type.itemType ) {
      for ( let i = 0; i < value.length; i++ ) {
        validateType( fullKey, value[ i ], type.itemType.type, type.itemType.example );
      }
    }

    return;
  }

  if ( type instanceof types.Tuple ) {

    if ( !Array.isArray( value ) || value.length !== type.items.length ) {
      throw new ValidationError( join( [
        `Option ${formatOption( fullKey )} must be an array of ${type.items.length} items.`,
        makeExample( fullKey, example )
      ] ) );
    }

    checkKeys( fullKey, value, type.items );

    return;
  }

  if ( typeof type === "string" ) {
    checkType( fullKey, actualType, type, example );
    return;
  }

  throw new Error( `Invalid schema. See ${fullKey}` );
}
