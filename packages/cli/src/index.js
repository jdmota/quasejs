import loudRejection from "./loud-rejection";

const path = require( "path" );
const chalk = require( "chalk" );
const hasYarn = require( "has-yarn" );
const updateNotifier = require( "update-notifier" );
const readPkgUp = require( "read-pkg-up" );
const importLocal = require( "import-local" );
const normalizePkg = require( "normalize-package-data" );
const yargsParser = require( "yargs-parser" );
const camelCase = require( "camelcase" );
const camelcaseKeys = require( "camelcase-keys" );
const decamelize = require( "decamelize" );
const trimNewlines = require( "trim-newlines" );
const redent = require( "redent" );
const { validate, getConfig, applyDefaults, t, types } = require( "@quase/config" );

/* eslint no-process-exit: 0 */
/* eslint no-console: 0 */

function isObject( x ) {
  return x != null && typeof x === "object";
}

function arrify( val ) {
  if ( val == null ) {
    return [];
  }
  return Array.isArray( val ) ? val : [ val ];
}

function notifyFix( opts ) {
  if ( !process.stdout.isTTY || !this.update ) {
    return this;
  }

  opts = Object.assign( {}, opts );

  opts.isGlobal = opts.isGlobal === undefined ? opts.isGlobal : require( "is-installed-globally" );

  const defaultMsg = hasYarn() ?
    `Update available ${chalk.dim( this.update.current )}${chalk.reset( " → " )}${chalk.green( this.update.latest )}` +
    ` \nRun ${chalk.cyan( `yarn ${opts.isGlobal ? "global " : ""}add ${this.packageName}` )} to update` :
    `Update available ${chalk.dim( this.update.current )}${chalk.reset( " → " )}${chalk.green( this.update.latest )}` +
    ` \nRun ${chalk.cyan( `npm i ${opts.isGlobal ? "-g " : ""}${this.packageName}` )} to update`;

  opts.message = opts.message || defaultMsg;

  opts.boxenOpts = opts.boxenOpts || {
    padding: 1,
    align: "center",
    borderStyle: {
      topLeft: " ",
      topRight: " ",
      bottomLeft: " ",
      bottomRight: " ",
      horizontal: " ",
      vertical: " "
    }
  };

  const message = "\n" + require( "boxen" )( opts.message, opts.boxenOpts );

  /* eslint-disable */
  if ( opts.defer === false ) {
    console.error( message );
  } else {
    process.on( "exit", () => {
      console.error( message );
    } );

    process.on( "SIGINT", () => {
      console.error( "" );
      process.exit();
    } );
  }
  /* eslint-enable */

  return this;
}

function notify( pkg, notifierOpts ) {
  const notifier = updateNotifier( Object.assign( { pkg }, notifierOpts.options ) );
  notifier.notify = notifyFix;
  notifier.notify( notifierOpts.notify );
}

// Prevent caching of this module so module.parent is always accurate
delete require.cache[ __filename ];
const filename = module.parent.filename;
const parentDir = path.dirname( filename );

function pad( str, length ) {
  while ( str.length < length ) {
    str += " ";
  }
  return str;
}

function typeToString( { type, choices } ) {
  if ( choices ) {
    return choices.map( JSON.stringify ).join( " | " );
  }
  if ( type ) {
    if ( typeof type === "string" ) {
      return type;
    }
    if ( type instanceof types.Tuple || type instanceof types.Array ) {
      return "array";
    }
    if ( type instanceof types.Object ) {
      return "object";
    }
    if ( type instanceof types.Union ) {
      return type.types.map( x => typeToString( { type: x } ) ).join( " | " );
    }
    if ( type instanceof types.Value ) {
      return JSON.stringify( type.value );
    }
  }
  return "";
}

function flattenSchema( schema ) {
  const newSchema = {};
  for ( const key in schema ) {
    const flag = schema[ key ];
    if ( flag ) {
      const { type } = flag;
      newSchema[ key ] = flag;

      if ( type ) {
        const list = type instanceof types.Union ? type.types : [ type ];

        for ( const type of list ) {
          if ( type instanceof types.Tuple ) {
            for ( let i = 0; i < type.items.length; i++ ) {
              newSchema[ `${key}.${i}` ] = type.items[ i ];
            }
          } else if ( type instanceof types.Object ) {
            for ( const k in type.properties ) {
              newSchema[ `${key}.${k}` ] = type.properties[ k ];
            }
          }
        }
      }
    }
  }
  return newSchema;
}

function generateHelp( { usage, commands, defaultCommand, schema, command, commandSet } ) {
  const optionLines = [];
  const commandLines = [];
  let optionsLength = 0;
  let commandsLength = 0;

  if ( !commandSet && commands ) {
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
    const flag = flattenedSchema[ key ];

    if ( flag.description != null ) {
      const typeStr = typeToString( flag );
      const prefix = flag.type === "boolean" && flag.default === true ? "no-" : "";
      const aliasText = flag.alias ? `, ${arrify( flag.alias ).map( a => `-${prefix}${a}` ).join( ", " )}` : "";

      const line = [
        `  --${prefix}${decamelize( key, "-" )}${aliasText}`,
        flag.description,
        typeStr ? `[${typeStr}]` : ""
      ];

      optionLines.push( line );

      if ( optionsLength < line[ 0 ].length ) {
        optionsLength = line[ 0 ].length;
      }
    }
  }

  let result = [
    usage ? `Usage: ${usage.replace( /<command>/, commandSet ? command : "<command>" )}\n` : ""
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

  if ( commandSet ) {
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

const DEFAULT = {};

function handleSchema( schema ) {
  return typeof schema === "function" ? schema( t ) : schema || {};
}

function handleArgs( opts ) {
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

  let providedArgv = opts.argv;
  let schema, command;
  let commandSet = false;

  if ( opts.commands ) {

    const c = opts.argv[ 0 ];

    if ( opts.argv.length === 0 || /^--?/.test( c ) ) {
      command = opts.defaultCommand;
    } else {
      commandSet = true;
      providedArgv = opts.argv.slice( 1 );
      command = camelCase( c );
    }

    if ( command ) {
      const commandInfo = opts.commands[ command ];
      schema = handleSchema( commandInfo && commandInfo.schema );
    } else {
      schema = handleSchema( opts.schema );
    }
  } else {
    schema = handleSchema( opts.schema );
  }

  if ( opts.configFiles ) {
    yargsOpts.string.push( "config" );
    yargsOpts.alias.c = "config";
  }

  if ( !opts.inferType ) {
    yargsOpts.string.push( "_" );
  }

  if ( schema[ "--" ] ) {
    yargsOpts[ "--" ] = true;
    yargsOpts.configuration[ "populate--" ] = true;
  }

  function fillOptions( schema, chain ) {
    for ( const k in schema ) {
      if ( !schema[ k ] ) {
        continue;
      }

      let { type, argType, alias, coerce, narg } = schema[ k ];
      let key = decamelize( k, "-" );

      argType = argType || type;

      chain.push( key );
      key = chain.join( "." );

      if ( argType ) {
        const acceptedTypes = argType instanceof types.Union ? argType.types : [ argType ];

        for ( const t of acceptedTypes ) {
          if ( t instanceof types.Object ) {
            fillOptions( t.properties, chain );
          } else if ( t instanceof types.Tuple ) {
            fillOptions( t.items, chain );
          } else {
            const arr = yargsOpts[ type instanceof types.Array ? "array" : t ];
            if ( Array.isArray( arr ) ) {
              arr.push( key );
              yargsOpts.default[ key ] = DEFAULT;
            }
          }
        }
      }

      if ( alias ) {
        const arr = yargsOpts.alias[ key ] = yargsOpts.alias[ key ] || [];
        arrify( alias ).forEach( a => {
          arr.push( a );
          allAlias.add( a );
        } );
      }
      if ( coerce ) {
        yargsOpts.coerce[ key ] = coerce;
      }
      if ( narg ) {
        yargsOpts.narg[ key ] = narg;
      }

      chain.pop();
    }
  }

  fillOptions( schema, [] );

  const { error, argv } = yargsParser.detailed( providedArgv, yargsOpts );

  if ( error ) {
    if ( /^Not enough arguments following/.test( error.message ) ) {
      error.__validation = true;
    }
    throw error;
  }

  function clear( obj, chain ) {
    for ( const key in obj ) {
      const v = obj[ key ];
      chain.push( key );
      if ( v === DEFAULT || allAlias.has( chain.join( "." ) ) ) {
        delete obj[ key ];
      } else if ( isObject( v ) ) {
        clear( v, chain );
      }
      chain.pop();
    }
  }

  clear( argv, [] );

  const input = argv._;
  delete argv._;

  const flags = camelcaseKeys( argv, { exclude: [ "--", /^\w$/ ], deep: true } );

  return {
    schema,
    command,
    commandSet,
    flags,
    input
  };
}

export default async function( _opts ) {
  if ( importLocal( filename ) ) {
    return;
  }
  loudRejection();

  const opts = Object.assign( {
    cwd: process.cwd(),
    inferType: false,
    autoHelp: true,
    autoVersion: true,
    argv: process.argv.slice( 2 ),
    schema: {},
    validate: true
  }, _opts );

  opts.cwd = path.resolve( opts.cwd );

  const { usage, commands, defaultCommand } = opts;
  const { schema, command, commandSet, input, flags } = handleArgs( opts );

  const pkg = opts.pkg ? opts.pkg : (
    await readPkgUp( {
      cwd: parentDir,
      normalize: false
    } )
  ).pkg;

  normalizePkg( pkg );

  let description;
  let help = redent(
    opts.help ?
      trimNewlines( opts.help.replace( /\t+\n*$/, "" ) ) :
      generateHelp( {
        schema, usage, defaultCommand, commands, command, commandSet
      } ),
    2
  );

  process.title = pkg.bin ? Object.keys( pkg.bin )[ 0 ] : pkg.name;
  description = !opts.description && opts.description !== false ? pkg.description : opts.description;
  help = ( description ? `\n  ${description}\n` : "" ) + ( help ? `\n${help}\n` : "\n" );

  const showHelp = code => {
    console.log( help );
    process.exit( typeof code === "number" ? code : 2 );
  };

  const showVersion = () => {
    console.log( typeof opts.version === "string" ? opts.version : pkg.version );
    process.exit();
  };

  if ( flags.version && opts.autoVersion ) {
    showVersion();
  }

  if ( flags.help && opts.autoHelp ) {
    showHelp( 0 );
  }

  const configJob = getConfig( {
    cwd: opts.cwd,
    configFiles: opts.configFiles ? flags.config || opts.configFiles : undefined,
    configKey: opts.configKey,
    failIfNotFound: !!flags.config
  } );

  if ( opts.notifier !== false ) {
    notify( pkg, opts.notifier || {} );
  }

  const { config, location: configLocation } = await configJob;

  const options = applyDefaults( schema, flags, config );

  if ( opts.validate && schema ) {

    const commandInfo = commands[ command ];

    if ( !commandInfo ) {
      const error = new Error( `${JSON.stringify( command )} is not a supported command` );
      error.__validation = true;
      throw error;
    }

    validate( schema, options );
  }

  return {
    command,
    input,
    options,
    flags,
    config,
    configLocation,
    pkg,
    help,
    showHelp,
    showVersion
  };
}
