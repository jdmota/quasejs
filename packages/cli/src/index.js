import { isObject, arrify, pad } from "./utils";
import loudRejection from "./loud-rejection";
import { typeToString, flattenSchema, fillOptions } from "./schema";

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
const { validate, getConfig, applyDefaults, t } = require( "@quase/config" );

/* eslint no-process-exit: 0 */
/* eslint no-console: 0 */

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

function generateHelpHelper( { usage, commands, defaultCommand, schema, command, commandSet } ) {
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
    allAlias.add( "c" );
  }

  if ( !opts.inferType ) {
    yargsOpts.string.push( "_" );
  }

  if ( schema[ "--" ] ) {
    yargsOpts[ "--" ] = true;
    yargsOpts.configuration[ "populate--" ] = true;
  }

  fillOptions( schema, yargsOpts, allAlias );

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
      if ( allAlias.has( chain.join( "." ) ) ) {
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

  const pkgJob = opts.pkg ? Promise.resolve( opts ) : readPkgUp( {
    cwd: parentDir,
    normalize: false
  } );

  const { usage, commands, defaultCommand } = opts;
  const { schema, command, commandSet, input, flags } = handleArgs( opts );

  const pkg = ( await pkgJob ).pkg;

  normalizePkg( pkg );

  process.title = pkg.bin ? Object.keys( pkg.bin )[ 0 ] : pkg.name;

  const generateHelp = () => {
    const description = !opts.description && opts.description !== false ? pkg.description : opts.description;
    const providedHelp = ( commandSet && commands[ command ] && commands[ command ].help ) || opts.help;
    const help = redent(
      providedHelp ?
        trimNewlines( providedHelp.replace( /\t+\n*$/, "" ) ) :
        generateHelpHelper( {
          schema, usage, defaultCommand, commands, command, commandSet
        } ),
      2
    );
    return ( description ? `\n  ${description}\n` : "" ) + ( help ? `\n${help}\n` : "\n" );
  };

  const showHelp = code => {
    console.log( generateHelp() );
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

  if ( opts.configFiles ) {
    delete flags.config;
  }

  const options = applyDefaults( schema, flags, config );

  if ( opts.validate ) {
    if ( commands ) {
      const commandInfo = commands[ command ];
      if ( !commandInfo ) {
        const error = new Error( `${JSON.stringify( command )} is not a supported command` );
        error.__validation = true;
        throw error;
      }
    }
    if ( schema ) {
      validate( schema, options );
    }
  }

  return {
    command,
    input,
    options,
    flags,
    config,
    configLocation,
    pkg,
    generateHelp,
    showHelp,
    showVersion
  };
}
