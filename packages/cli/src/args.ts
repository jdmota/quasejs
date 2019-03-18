import { Schema, CliOptions, ArgsInfo, CommandSet } from "./types";
import { isObject } from "./utils";

const schemaCompiler = require( "@quase/schema/dist/compiler" ).default;
const yargsParser = require( "yargs-parser" );
const camelCase = require( "camelcase" );
const camelcaseKeys = require( "camelcase-keys" );

function compileSchema( schema: string ): Schema {
  return eval( schemaCompiler( schema ) ); // eslint-disable-line no-eval
}

function validationError( msg: string ) {
  const error = new Error( msg );
  // @ts-ignore
  error.__validation = true;
  throw error;
}

function missingSchema( command: string | undefined ) {
  throw new Error( `Missing schema${command ? ` for command ${command}` : ""}` );
}

function clearAlias( obj: any, chain: string[], allAlias: Set<string> ) {
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

export function handleArgs( opts: CliOptions ): ArgsInfo {
  let argv = opts.argv;
  let schema;
  let command: CommandSet = {
    value: undefined,
    set: false
  };

  if ( opts.commands ) {

    const c = argv[ 0 ];

    if ( argv.length === 0 || /^--?/.test( c ) ) {
      command = {
        value: opts.defaultCommand,
        set: false
      };
    } else {
      command = {
        value: camelCase( c ) as string,
        set: true
      };
      argv = argv.slice( 1 );
    }

    if ( command.value ) {
      const commandInfo = opts.commands[ command.value ];
      if ( !commandInfo ) {
        validationError( `${JSON.stringify( command.value )} is not a supported command` );
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
    missingSchema( command && command.value );
  }

  if ( typeof schema === "string" ) {
    schema = compileSchema( schema );
  }

  schema.cli.yargsOpts.configuration = {
    "camel-case-expansion": false
  };

  const allAlias = new Set( schema.cli.allAlias );

  if ( opts.configFiles ) {
    schema.cli.yargsOpts.string.push( "config" );
    schema.cli.yargsOpts.alias.c = [ "config" ];
    allAlias.add( "c" );
  }

  if ( !opts.inferType ) {
    schema.cli.yargsOpts.string.push( "_" );
  }

  if ( opts[ "populate--" ] ) {
    schema.cli.yargsOpts[ "--" ] = true;
    schema.cli.yargsOpts.configuration[ "populate--" ] = true;
  }

  const allBooleans = new Set( schema.cli.yargsOpts.boolean );
  schema.cli.yargsOpts.boolean = [];

  const yargsResult = yargsParser.detailed( argv, schema.cli.yargsOpts );

  const { argv: yargsFlags, error } = yargsResult;

  if ( error ) {
    if ( /^Not enough arguments following/.test( error.message ) ) {
      error.__validation = true;
    }
    throw error;
  }

  const input = yargsFlags._;
  const slashSlash = yargsFlags[ "--" ];
  delete yargsFlags._;
  delete yargsFlags[ "--" ];

  clearAlias( yargsFlags, [], allAlias );

  for ( const key in yargsFlags ) {
    if ( allBooleans.has( key ) ) {
      if ( yargsFlags[ key ] === "" || yargsFlags[ key ] === "true" ) {
        yargsFlags[ key ] = true;
      } else if ( yargsFlags[ key ] === "false" ) {
        yargsFlags[ key ] = false;
      }
    }
  }

  const flags = camelcaseKeys( yargsFlags, { exclude: [ "--", /^\w$/ ], deep: true } );

  return {
    schema,
    command,
    flags,
    input,
    "--": slashSlash
  };
}
