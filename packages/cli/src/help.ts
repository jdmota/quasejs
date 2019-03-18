import { CliOptions, ArgsInfo, Schema, Command, CommandSet, Pkg } from "./types";
import { pad } from "./utils";

const decamelize = require( "decamelize" );
const trimNewlines = require( "trim-newlines" );
const redent = require( "redent" );

type HelperArg = {
  usage: string | undefined;
  commands: { [key: string]: Command } | undefined;
  command: CommandSet;
  defaultCommand: string | undefined;
  schema: Schema;
};

function generateHelpHelper(
  { usage, commands, defaultCommand, schema, command }: HelperArg
) {
  const commandLines = [];
  let commandsLength = 0;

  if ( !command.set && commands ) {
    for ( const key in commands ) {
      const { description } = commands[ key ];

      if ( description != null ) {
        const line = [
          `  ${decamelize( key, "-" )}`,
          description,
          key === defaultCommand ? `[default]` : ""
        ];

        commandLines.push( line );

        if ( commandsLength < line[ 0 ].length ) {
          commandsLength = line[ 0 ].length;
        }
      }
    }
  }

  let result = [
    usage ? `Usage: ${usage.replace( /<command>/, command.set ? command.value : "<command>" )}\n` : ""
  ];

  if ( commandLines.length ) {
    result = result.concat(
      "Commands:",
      commandLines.map( line => {
        line[ 0 ] = pad( line[ 0 ], commandsLength );
        return line.filter( Boolean ).join( " " );
      } )
    );
  }

  if ( command.set && commands ) {
    const commandInfo = commands[ command.value ];
    if ( commandInfo && commandInfo.description ) {
      result.push( commandInfo.description + "\n" );
    }
  }

  if ( commandLines.length ) {
    result.push( "" );
  }

  if ( schema.cli.help ) {
    result.push( schema.cli.help );
  }

  return result.join( "\n" );
}

export function generateHelp( opts: CliOptions, pkg: Pkg, argsInfo: ArgsInfo ) {
  const { schema, command } = argsInfo;
  const { usage, commands, defaultCommand } = opts;
  const description = !opts.description && opts.description !== false ? pkg.description : opts.description;
  const providedHelp = (
    commands && command.set &&
    commands[ command.value ] && commands[ command.value ].help
  ) || opts.help;
  const help = redent(
    providedHelp ?
      trimNewlines( providedHelp.replace( /\t+\n*$/, "" ) ) :
      generateHelpHelper( {
        schema, usage, defaultCommand, commands, command
      } ),
    2
  ).trimRight();
  return ( description ? `\n  ${description}\n` : "" ) + ( help ? `\n${help}\n` : "\n" );
}
