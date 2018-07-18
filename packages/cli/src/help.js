import { arrify, pad } from "./utils";
import { typeToString, flattenSchema } from "./schema";

const decamelize = require( "decamelize" );
const trimNewlines = require( "trim-newlines" );
const redent = require( "redent" );

function suffixDefault( d ) {
  if ( typeof d === "boolean" || typeof d === "number" ) {
    return `(default: ${d})`;
  }
  if ( typeof d === "string" ) {
    if ( d.length < 15 ) {
      return `(default: ${JSON.stringify( d )})`;
    }
  }
  return "";
}

function generateHelpHelper( { usage, commands, defaultCommand, schema, command, commandWasSet } ) {
  const optionLines = [];
  const commandLines = [];
  let optionsLength = 0;
  let commandsLength = 0;

  if ( !commandWasSet && commands ) {
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

  const flattenedSchema = flattenSchema( schema );

  for ( const key in flattenedSchema ) {
    const type = flattenedSchema[ key ];
    const flag = type.extra;

    if ( flag.description != null ) {
      const typeStr = typeToString( type );
      const aliasText = flag.alias ? `, ${arrify( flag.alias ).map( a => `-${a}` ).join( ", " )}` : "";

      const line = [
        `  --${decamelize( key, "-" )}${aliasText}`,
        flag.description,
        suffixDefault( type.default ),
        typeStr ? `[${typeStr}]` : ""
      ];

      optionLines.push( line );

      if ( optionsLength < line[ 0 ].length ) {
        optionsLength = line[ 0 ].length;
      }
    }
  }

  let result = [
    usage ? `Usage: ${usage.replace( /<command>/, commandWasSet ? command : "<command>" )}\n` : ""
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

  if ( commandWasSet ) {
    const commandInfo = commands[ command ];
    if ( commandInfo && commandInfo.description ) {
      result.push( commandInfo.description + "\n" );
    }
  }

  if ( optionLines.length ) {
    result = result.concat(
      commandLines.length ? "\nOptions:" : "Options:",
      optionLines.map( line => {
        line[ 0 ] = pad( line[ 0 ], optionsLength );
        return line.filter( Boolean ).join( " " );
      } )
    );
  }

  return result.join( "\n" );
}

export function generateHelp( opts, pkg, argsInfo ) {
  const { schema, command, commandWasSet } = argsInfo;
  const { usage, commands, defaultCommand } = opts;
  const description = !opts.description && opts.description !== false ? pkg.description : opts.description;
  const providedHelp = ( commandWasSet && commands[ command ] && commands[ command ].help ) || opts.help;
  const help = redent(
    providedHelp ?
      trimNewlines( providedHelp.replace( /\t+\n*$/, "" ) ) :
      generateHelpHelper( {
        schema, usage, defaultCommand, commands, command, commandWasSet
      } ),
    2
  );
  return ( description ? `\n  ${description}\n` : "" ) + ( help ? `\n${help}\n` : "\n" );
}
