// @flow
/* eslint-disable no-console */
import getType from "./get-type";

const concordance = require( "concordance" );
const chalk = require( "chalk" );
const leven = require( "leven" );

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

  constructor( config: ?Object ) {
    this.config = config || {};
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

    throw new ValidationError( message );
  }

  checkType( option: string, defaultValue: any ) {
    const actualType = getType( this.config[ option ] );
    const expectedType = getType( defaultValue );

    if ( actualType === expectedType ) {
      return;
    }

    this.throwWrongType( option, actualType, expectedType, defaultValue );
  }

  throwWrongType( option: string, actualType: string, expectedType: string, defaultValue: any ) {

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

    throw new ValidationError( messageLines.join( "\n" ) );
  }

  checkDeprecated( option: string, message: ?string ) {
    if ( this.config[ option ] ) {
      message = message || `Option ${formatOption( option )} is deprecated.`;
      printWarning( `${chalk.bold( "Deprecation Warning" )}: ${message}` );
    }
  }

}

export function createValidator( fn: ( Object, Checker ) => {} ) {
  return function( config: ?Object ) {
    const checker = new Checker( config );
    try {
      fn( checker.config, checker );
    } catch ( e ) {
      printError( e );
    }
  };
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
