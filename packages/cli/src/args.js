import { isObject } from "./utils";
import { fillYargsOptions } from "./schema";

const yargsParser = require( "yargs-parser" );
const camelCase = require( "camelcase" );
const camelcaseKeys = require( "camelcase-keys" );

function validationError( msg ) {
  const error = new Error( msg );
  error.__validation = true;
  throw error;
}

function missingSchema( command ) {
  throw new Error( `Missing schema${command ? ` for command ${command}` : ""}` );
}

function clearAlias( obj, chain, allAlias ) {
  for ( const key in obj ) {
    const v = obj[ key ];
    chain.push( key );
    if ( allAlias.has( chain.join( "." ) ) ) {
      delete obj[ key ];
    } else if ( isObject( v ) ) {
      clearAlias( v, chain, allAlias );
    }
    chain.pop();
  }
}

export function handleArgs( opts ) {
  const allAlias = new Set();
  const yargsOpts = {
    alias: {},
    array: [],
    boolean: [],
    coerce: {},
    count: [],
    default: {},
    string: [],
    narg: {},
    number: [],
    configuration: {
      "camel-case-expansion": false
    }
  };

  let argv = opts.argv;
  let schema, command;
  let commandWasSet = false;

  if ( opts.commands ) {

    const c = argv[ 0 ];

    if ( argv.length === 0 || /^--?/.test( c ) ) {
      command = opts.defaultCommand;
    } else {
      commandWasSet = true;
      command = camelCase( c );
      argv = argv.slice( 1 );
    }

    if ( command ) {
      const commandInfo = opts.commands[ command ];
      if ( !commandInfo ) {
        validationError( `${JSON.stringify( command )} is not a supported command` );
      }
      schema = commandInfo.schema;
    } else {
      if ( !opts.schema ) {
        validationError( `Command required. E.g. ${Object.keys( opts.commands ).slice( 0, 3 ).join( ", " )}` );
      }
      schema = opts.schema;
    }
  } else {
    schema = opts.schema;
  }

  if ( !schema ) {
    missingSchema( command );
  }

  if ( opts.configFiles ) {
    yargsOpts.string.push( "config" );
    yargsOpts.alias.c = "config";
    allAlias.add( "c" );
  }

  if ( !opts.inferType ) {
    yargsOpts.string.push( "_" );
  }

  if ( schema[ "--" ] ) {
    yargsOpts[ "--" ] = true;
    yargsOpts.configuration[ "populate--" ] = true;
  }

  const booleans = new Set();

  fillYargsOptions( schema, yargsOpts, allAlias, booleans );

  const yargsResult = yargsParser.detailed( argv, yargsOpts );
  const error = yargsResult.error;
  argv = yargsResult.argv;

  if ( error ) {
    if ( /^Not enough arguments following/.test( error.message ) ) {
      error.__validation = true;
    }
    throw error;
  }

  const input = argv._;
  delete argv._;

  clearAlias( argv, [], allAlias );

  for ( const key in argv ) {
    if ( booleans.has( key ) ) {
      if ( argv[ key ] === "" || argv[ key ] === "true" ) {
        argv[ key ] = true;
      } else if ( argv[ key ] === "false" ) {
        argv[ key ] = false;
      }
    }
  }

  const flags = camelcaseKeys( argv, { exclude: [ "--", /^\w$/ ], deep: true } );

  return {
    schema,
    command,
    commandWasSet,
    flags,
    input
  };
}
