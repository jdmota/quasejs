import { Schema, CliOptions, ArgsInfo, CommandSet, CommandsOpts } from "./types";
import camelCase from "camelcase";
import camelcaseKeys from "camelcase-keys";

const schemaCompiler = require( "@quase/schema/dist/compiler" ).default;
const yargsParser = require( "yargs-parser" );

function compileSchema( schema: string ): Schema {
  return eval( schemaCompiler( schema ) ); // eslint-disable-line no-eval
}

function validationError( msg: string ) {
  const error = new Error( msg );
  // @ts-ignore
  error.__validation = true;
  throw error;
}

function missingSchema( command: string[] ) {
  throw new Error( `Missing schema${command.length ? ` for command ${command.join( " " )}` : ""}` );
}

export function handleArgs( opts: CliOptions ): ArgsInfo {
  let argv = opts.argv.filter( Boolean );
  let schema;
  const commandSet: CommandSet = {
    value: [],
    detail: {
      last: undefined,
      set: false
    }
  };

  let parentCommandOpts: CommandsOpts | null = null;
  let commandOpts: CommandsOpts = opts;
  let readingCommands = true;

  while ( readingCommands ) {
    readingCommands = false;

    if ( commandOpts.commands ) {

      const c = argv[ 0 ];

      if ( argv.length === 0 || /^--?/.test( c ) ) {
        if ( commandOpts.requiredCommand ) {
          const context = commandSet.value.join( " " );
          const examples = Object.keys( commandOpts.commands ).slice( 0, 3 ).join( "|" );
          validationError( `Command required. Example: ${context ? context + " " : ""}${examples}` );
        }
        if ( commandOpts.defaultCommand ) {
          commandSet.value.push( commandOpts.defaultCommand );
          commandSet.detail = {
            last: commandOpts.defaultCommand,
            set: false
          };
        }
      } else {
        commandSet.value.push( camelCase( c ) );
        commandSet.detail = {
          last: camelCase( c ),
          set: true
        };
        argv = argv.slice( 1 );
        readingCommands = true;
      }

      const { last } = commandSet.detail;

      if ( last ) {
        const commandInfo = commandOpts.commands[ last ];
        if ( !commandInfo ) {
          validationError( `${commandSet.value.join( " " )} is not a supported command` );
        }
        parentCommandOpts = commandOpts;
        commandOpts = commandInfo;
      }
    }
  }

  schema = commandOpts.schema;

  if ( !schema ) {
    missingSchema( commandSet.value );
  }

  if ( typeof schema === "string" ) {
    schema = compileSchema( schema );
  }

  schema.cli.yargsOpts.configuration = {
    "camel-case-expansion": false,
    "strip-aliased": true
  };

  if ( opts.configFiles ) {
    schema.cli.yargsOpts.string.push( "config" );
    schema.cli.yargsOpts.alias.config = [ "c" ];
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
    argv,
    schema,
    parentCommandOpts,
    commandOpts,
    commandSet,
    flags,
    input,
    "--": slashSlash
  };
}
