// @flow
/* eslint-disable no-console */
import getType from "./get-type";

const concordance = require( "concordance" );
const chalk = require( "chalk" );
const leven = require( "leven" );

export { getType };

export class ValidationError extends Error {}

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

export class Checker {

  +config: Object;
  +schema: ?Object;

  constructor( config: ?Object, schema: ?Object ) {
    this.config = config || {};
    this.schema = schema;
  }

  validationError( message: string ) {
    throw new ValidationError( message );
  }

  getType( value: mixed ) {
    return getType( value );
  }

  checkUnrecognized( allowedOptions: Array<string>, type: ?string ) {

    const options = Object.keys( this.config );
    const unrecognizedOptions = options.filter( arg => !allowedOptions.includes( arg ) );

    if ( unrecognizedOptions.length === 0 ) {
      return;
    }

    type = type || "option";
    let message;

    if ( unrecognizedOptions.length === 1 ) {
      const unrecognized = unrecognizedOptions[ 0 ];
      const didYouMeanMessage = createDidYouMeanMessage( unrecognized, allowedOptions );
      message = `  Unrecognized ${type} ${formatOption( unrecognized )}. ${didYouMeanMessage}`.trimRight();
    } else {
      message = `  Following ${type}s were not recognized:\n  ${unrecognizedOptions.map( formatOption ).join( ", " )}`;
    }

    this.validationError( message );
  }

  checkType( option: string, actualType: string, expectedType: string, defaultValue: any ) {

    if ( actualType === expectedType ) {
      return;
    }

    const messageLines = [
      `  Option ${formatOption( option )} must be of type:`,
      `    ${chalk.bold.green( expectedType )}`,
      `  but instead received:`,
      `    ${chalk.bold.red( actualType )}`
    ];

    if ( defaultValue !== undefined ) {
      messageLines.push( `  Example:` );
      messageLines.push( `  {` );
      messageLines.push( `    ${formatOption( option )}: ${chalk.bold( format( defaultValue ) )}` );
      messageLines.push( `  }` );
    }

    this.validationError( messageLines.join( "\n" ) );
  }

  checkDeprecated( option: string, message: ?string ) {
    if ( this.config[ option ] ) {
      message = message || `Option ${formatOption( option )} is deprecated.`;
      printWarning( `${chalk.bold( "Deprecation Warning" )}: ${message}` );
    }
  }

}

export function validate( config: ?Object, schema: ?Object, fn: ?( Checker ) => {} ) {
  const c = new Checker( config, schema );

  try {
    if ( schema ) {
      const deprecatedKeys = [];

      c.checkUnrecognized( Object.keys( schema ) );

      for ( const key in schema ) {
        const { type, default: _default, deprecated, example } = schema[ key ];
        if ( deprecated ) {
          deprecatedKeys.push( key );
        }
        if ( type ) {
          c.checkType( key, getType( c.config[ key ] ), type, example === undefined ? _default : example );
        }
      }

      for ( const key of deprecatedKeys ) {
        c.checkDeprecated( key );
      }
    }

    if ( fn ) {
      fn( c );
    }
  } catch ( e ) {
    printError( e );
  }
}

export function printWarning( str: string ) {
  console.warn( `${chalk.yellow( str )}\n` );
}

export function printError( error: Error ) {
  let message;
  if ( error instanceof ValidationError ) {
    message = `${chalk.bold( "Validation Error" )}:\n\n${error.message}`;
  } else {
    message = error.stack;
  }
  console.error( `${chalk.red( message )}\n` );
  process.exitCode = 1;
}
